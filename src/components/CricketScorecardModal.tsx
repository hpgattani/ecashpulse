import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useCricketScorecard } from '@/hooks/useCricketScore';

import scotlandCricketLogo from '@/assets/teams/scotland-cricket.png';
import englandCricketLogo from '@/assets/teams/england-cricket.png';

interface CricketScorecardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string | null;
  team1Score: string | null;
  team2Score: string | null;
  status: string;
  statusText: string;
  venue: string;
}

const CricketScorecardModal = ({
  open,
  onOpenChange,
  matchId,
  team1Score,
  team2Score,
  status,
  statusText,
  venue,
}: CricketScorecardModalProps) => {
  const { scorecard, loading } = useCricketScorecard(open ? matchId : null);

  const innings = scorecard?.scorecard?.scorecard || scorecard?.scorecard?.score || [];
  const matchInfo = scorecard?.matchInfo || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            ICC T20 World Cup
          </DialogTitle>
        </DialogHeader>

        {/* Match Summary Header */}
        <div className="px-4 py-3 bg-muted/30">
          <div className="flex items-center justify-between">
            {/* Scotland */}
            <div className="flex items-center gap-2">
              <img src={scotlandCricketLogo} alt="Scotland" className="w-8 h-8 rounded-sm object-contain" />
              <div>
                <p className="font-semibold text-sm text-foreground">Scotland</p>
                <p className="text-xs font-mono text-primary">
                  {team1Score || 'Yet to bat'}
                </p>
              </div>
            </div>

            <span className="text-xs text-muted-foreground font-medium px-2">vs</span>

            {/* England */}
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="font-semibold text-sm text-foreground">England</p>
                <p className="text-xs font-mono text-primary">
                  {team2Score || 'Yet to bat'}
                </p>
              </div>
              <img src={englandCricketLogo} alt="England" className="w-8 h-8 rounded-sm object-contain" />
            </div>
          </div>

          {/* Status */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              {status === 'in_progress' && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse mr-1" />
              )}
              <span className={status === 'in_progress' ? 'text-orange-500 font-semibold' : ''}>
                {statusText || (status === 'scheduled' ? 'Upcoming' : status === 'final' ? 'Match Complete' : 'Live')}
              </span>
            </div>
            {venue && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[180px]">{venue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scorecard Content */}
        <ScrollArea className="flex-1 max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading scorecard...</span>
            </div>
          ) : innings.length > 0 ? (
            <Tabs defaultValue="0" className="px-4 pb-4">
              <TabsList className="w-full">
                {innings.map((inn: any, i: number) => (
                  <TabsTrigger key={i} value={String(i)} className="flex-1 text-xs">
                    {inn.inning || `Innings ${i + 1}`}
                  </TabsTrigger>
                ))}
              </TabsList>

              {innings.map((inn: any, i: number) => (
                <TabsContent key={i} value={String(i)} className="mt-3">
                  {/* Batting */}
                  {inn.batsman && inn.batsman.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Batting</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8 px-2">Batter</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">R</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">B</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">4s</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">6s</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">SR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inn.batsman.map((bat: any, j: number) => (
                            <TableRow key={j}>
                              <TableCell className="text-xs px-2 py-1.5 font-medium">
                                {bat.batsman || bat.name}
                                {bat.dismissal && (
                                  <span className="block text-[10px] text-muted-foreground truncate max-w-[120px]">
                                    {bat.dismissal || bat['dismissal-text']}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right font-bold">{bat.r}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bat.b}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bat['4s']}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bat['6s']}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bat.sr}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Bowling */}
                  {inn.bowler && inn.bowler.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bowling</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs h-8 px-2">Bowler</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">O</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">R</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">W</TableHead>
                            <TableHead className="text-xs h-8 px-2 text-right">Econ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inn.bowler.map((bowl: any, j: number) => (
                            <TableRow key={j}>
                              <TableCell className="text-xs px-2 py-1.5 font-medium">{bowl.bowler || bowl.name}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bowl.o}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bowl.r}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right font-bold">{bowl.w}</TableCell>
                              <TableCell className="text-xs px-2 py-1.5 text-right">{bowl.eco}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="text-center py-12 px-4">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {status === 'scheduled' 
                  ? 'Scorecard will be available once the match begins' 
                  : 'No scorecard data available yet'}
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Match Status Footer */}
        {statusText && (
          <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-center text-muted-foreground italic">{statusText}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CricketScorecardModal;
