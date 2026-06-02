import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ChronikClient } from 'https://esm.sh/chronik-client@3.6.1';
import {
  toHex, fromHex, hash160,
  decodeWIF, cashAddrToHash160,
  createP2PKHScript, createCashtabMessageScript,
  getPublicKey, buildSignedTransaction,
  type TxInput, type TxOutput,
} from '../_shared/crypto.ts';
import { hash160ToCashAddr } from '../_shared/cashaddr.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const chronik = new ChronikClient(['https://chronik.e.cash']);
const ESCROW_ADDRESS = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const PLATFORM_FEE_PERCENT = 0.01;
const PRIZE_SPLITS = [0.60, 0.25, 0.15];
const DUST_THRESHOLD = 546;

interface UTXO {
  outpoint: { txid: string; outIdx: number };
  blockHeight: number;
  isCoinbase: boolean;
  value: string;
  isFinal: boolean;
  token?: any;
}

interface GameWinner {
  rank: number;
  playerAddressHash: string;
  address: string;
  score: number;
  prizeAmount: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only: must be invoked with the service role key (cron / other edge functions).
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const serviceKeyHeader = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKeyHeader || authHeader !== `Bearer ${serviceKeyHeader}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = serviceKeyHeader;
    const escrowWif = Deno.env.get('ESCROW_PRIVATE_KEY_WIF');
    if (!escrowWif) throw new Error('ESCROW_PRIVATE_KEY_WIF not configured');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    const currentYear = now.getFullYear();
    
    const { data: leaderboards, error: lbError } = await supabase
      .from('game_leaderboards')
      .select(`id, game_id, week_number, year, total_pot, status, mini_games (name, slug)`)
      .eq('status', 'active')
      .or(`year.lt.${currentYear},and(year.eq.${currentYear},week_number.lt.${currentWeek})`);
    
    if (lbError) throw lbError;
    
    if (!leaderboards || leaderboards.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No leaderboards to resolve', resolved: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Found ${leaderboards.length} leaderboards to resolve`);
    const results: any[] = [];
    
    for (const leaderboard of leaderboards) {
      try {
        const { data: sessions, error: sessionsError } = await supabase
          .from('game_sessions')
          .select('player_address_hash, score')
          .eq('game_id', leaderboard.game_id)
          .eq('week_number', leaderboard.week_number)
          .eq('year', leaderboard.year)
          .eq('is_competitive', true)
          .order('score', { ascending: false })
          .limit(100);
        
        if (sessionsError) throw sessionsError;
        
        if (!sessions || sessions.length === 0) {
          await supabase.from('game_leaderboards').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', leaderboard.id);
          results.push({ leaderboardId: leaderboard.id, status: 'no_players', message: 'No competitive players' });
          continue;
        }
        
        const playerBestScores = new Map<string, number>();
        for (const session of sessions) {
          const current = playerBestScores.get(session.player_address_hash) || 0;
          if (session.score > current) playerBestScores.set(session.player_address_hash, session.score);
        }
        
        const rankedPlayers = Array.from(playerBestScores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        
        if (rankedPlayers.length === 0) {
          await supabase.from('game_leaderboards').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', leaderboard.id);
          results.push({ leaderboardId: leaderboard.id, status: 'no_players', message: 'No ranked players' });
          continue;
        }
        
        const totalPot = leaderboard.total_pot;
        const netPot = Math.floor(totalPot * (1 - PLATFORM_FEE_PERCENT));
        
        const hashBytes = fromHex(rankedPlayers[0][0]);
        const winners: GameWinner[] = rankedPlayers.map(([playerHash, score], index) => {
          const prizeAmount = Math.floor(netPot * PRIZE_SPLITS[index]);
          return {
            rank: index + 1,
            playerAddressHash: playerHash,
            address: hash160ToCashAddr(fromHex(playerHash)),
            score,
            prizeAmount
          };
        }).filter(w => w.prizeAmount >= DUST_THRESHOLD);
        
        if (winners.length === 0) {
          await supabase.from('game_leaderboards').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', leaderboard.id);
          results.push({ leaderboardId: leaderboard.id, status: 'prizes_too_small', message: 'Prize amounts below dust threshold' });
          continue;
        }
        
        console.log(`Paying ${winners.length} winners for leaderboard ${leaderboard.id}`);
        
        const escrowAddrHash = cashAddrToHash160(ESCROW_ADDRESS);
        if (!escrowAddrHash) throw new Error('Invalid escrow address');
        const addressHashHex = toHex(escrowAddrHash);
        
        const utxoResult = await chronik.script('p2pkh', addressHashHex).utxos();
        const rawUtxos = utxoResult.utxos || [];
        const validUtxos = rawUtxos
          .filter((u: any) => !u.token && parseInt(String(u.sats ?? u.value ?? 0)) > DUST_THRESHOLD)
          .map((u: any) => ({
            outpoint: u.outpoint,
            blockHeight: u.blockHeight,
            isCoinbase: u.isCoinbase,
            value: String(u.sats ?? u.value ?? 0),
            isFinal: u.isFinal,
            token: u.token
          })) as UTXO[];
        
        if (validUtxos.length === 0) {
          results.push({ leaderboardId: leaderboard.id, status: 'no_utxos', message: 'No UTXOs available' });
          continue;
        }
        
        const totalPayouts = winners.reduce((sum, w) => sum + w.prizeAmount, 0);
        const estimatedFee = 500 + (winners.length * 34) + (validUtxos.length * 148);
        const requiredAmount = totalPayouts + estimatedFee;
        
        let selectedValue = 0n;
        const selectedUtxos: UTXO[] = [];
        for (const utxo of validUtxos.sort((a, b) => parseInt(b.value) - parseInt(a.value))) {
          selectedUtxos.push(utxo);
          selectedValue += BigInt(utxo.value);
          if (selectedValue >= BigInt(requiredAmount)) break;
        }
        
        if (selectedValue < BigInt(requiredAmount)) {
          results.push({ leaderboardId: leaderboard.id, status: 'insufficient_funds', message: `Need ${requiredAmount} sats, have ${selectedValue}` });
          continue;
        }
        
        const wifResult = decodeWIF(escrowWif);
        if (!wifResult) throw new Error('Invalid WIF');
        const { privateKey, compressed } = wifResult;
        const pubKey = await getPublicKey(privateKey, compressed);
        const pubKeyHash = await hash160(pubKey);
        const scriptPubKey = createP2PKHScript(pubKeyHash);
        
        const inputs: TxInput[] = selectedUtxos.map(u => ({
          txid: u.outpoint.txid, vout: u.outpoint.outIdx, value: BigInt(u.value), scriptPubKey
        }));
        
        const outputs: TxOutput[] = [];
        for (const winner of winners) {
          const recipientHash = fromHex(winner.playerAddressHash);
          outputs.push({ value: BigInt(winner.prizeAmount), scriptPubKey: createP2PKHScript(recipientHash) });
        }
        
        const gameName = (leaderboard as any).mini_games?.name || 'Game';
        const message = `Congrats! You placed #${winners.map(w => w.rank).join('/')} in ${gameName} Week ${leaderboard.week_number}!`;
        outputs.push({ value: 0n, scriptPubKey: createCashtabMessageScript(message) });
        
        const outputsValue = outputs.reduce((sum, o) => sum + o.value, 0n);
        const changeValue = selectedValue - outputsValue - BigInt(estimatedFee);
        if (changeValue >= BigInt(DUST_THRESHOLD)) {
          outputs.push({ value: changeValue, scriptPubKey });
        }
        
        const rawTx = await buildSignedTransaction(inputs, outputs, privateKey, compressed);
        console.log(`Broadcasting game payout tx for leaderboard ${leaderboard.id}`);
        const broadcastResult = await chronik.broadcastTx(toHex(rawTx));
        const txHash = broadcastResult.txid;
        console.log(`Game payout tx broadcast: ${txHash}`);
        
        for (const winner of winners) {
          await supabase.from('game_winners').insert({
            leaderboard_id: leaderboard.id,
            player_address_hash: winner.playerAddressHash,
            rank: winner.rank,
            score: winner.score,
            prize_amount: winner.prizeAmount,
            payout_tx_hash: txHash
          });
        }
        
        await supabase.from('game_leaderboards').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', leaderboard.id);
        
        results.push({
          leaderboardId: leaderboard.id, status: 'success', txHash,
          winners: winners.map(w => ({ rank: w.rank, address: w.address, score: w.score, prize: w.prizeAmount }))
        });
        
      } catch (error) {
        console.error(`Error resolving leaderboard ${leaderboard.id}:`, error);
        results.push({ leaderboardId: leaderboard.id, status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    return new Response(JSON.stringify({ success: true, resolved: results.filter(r => r.status === 'success').length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Game payout error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
