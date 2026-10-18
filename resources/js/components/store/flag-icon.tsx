import type { Language } from '@/hooks/use-translation';

type FlagIconProps = {
    language: Language;
};

export default function FlagIcon({ language }: FlagIconProps) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 20 14"
            className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm ring-1 ring-inset ring-black/10"
        >
            {language === 'ID' ? (
                <>
                    <rect width="20" height="7" fill="#CE1126" />
                    <rect y="7" width="20" height="7" fill="#FFFFFF" />
                </>
            ) : (
                <>
                    <rect width="20" height="14" fill="#012169" />
                    <path d="M0 0h2.5L20 11.5V14h-2.5L0 2.5zM20 0h-2.5L0 11.5V14h2.5L20 2.5z" fill="#FFFFFF" />
                    <path d="M0 0h1.1L20 12.9V14h-1.1L0 1.1zM20 0h-1.1L0 12.9V14h1.1L20 1.1z" fill="#C8102E" />
                    <path d="M8 0h4v14H8zM0 5h20v4H0z" fill="#FFFFFF" />
                    <path d="M9 0h2v14H9zM0 6h20v2H0z" fill="#C8102E" />
                </>
            )}
        </svg>
    );
}
