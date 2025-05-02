'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the GameCanvas component within a Client Component
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  loading: () => <p className="text-center text-xl mt-10">Loading Game...</p>,
  ssr: false // This is allowed in a Client Component
});

const GameLoader: React.FC = () => {
    // This component just renders the dynamically loaded GameCanvas
    return <GameCanvas />;
};

export default GameLoader; 