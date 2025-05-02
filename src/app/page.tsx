import dynamic from 'next/dynamic';
import LanguageToggle from '@/components/LanguageToggle';

// Dynamically import the GameCanvas component
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  loading: () => <p className="text-center text-xl mt-10">Loading Game...</p>,
  ssr: false // Phaser interacts with window/document, disable SSR for this component
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-0 relative">
      <LanguageToggle />
      {/* Container for the game canvas */}
      <div style={{ width: '100vw', height: '100vh' }}> 
        <GameCanvas />
      </div>
    </main>
  );
}
