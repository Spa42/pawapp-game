import LanguageToggle from '@/components/LanguageToggle';
import GameLoader from '@/components/GameLoader';

// page.tsx remains a Server Component
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-0 relative">
      <LanguageToggle />
      {/* Container for the game canvas */}
      <div style={{ width: '100vw', height: '100vh' }}> 
        {/* Render the loader component which handles dynamic import */}
        <GameLoader /> 
      </div>
    </main>
  );
}
