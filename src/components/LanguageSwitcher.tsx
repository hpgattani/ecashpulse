import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

const languages = [
  { code: 'en' as const, label: 'English', flag: '🇺🇸' },
  { code: 'pt-BR' as const, label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'ko' as const, label: '한국어', flag: '🇰🇷' },
  { code: 'ja' as const, label: '日本語', flag: '🇯🇵' },
];

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useLanguage();
  
  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? 'bg-primary/10' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
