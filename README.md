# PawApp Mini-Game

This repository contains the code for an endless runner mini-game created for **PawApp**, a company based in Kuwait.

## Game Description

The game is built using the **Phaser 3** game framework for the core game logic, rendering, and physics. It's integrated within a **Next.js** (React) application, which serves as the web wrapper and handles the initial page load and component structure (`src/components/GameCanvas.tsx`).

Players control the PawApp mascot, navigating an infinitely scrolling environment. The objectives are to:
*   Avoid obstacles.
*   Rescue stray animals by running into them.
*   Collect power-ups (currently providing an extra life/"Gold Collar" or a double jump).
*   Achieve the highest score possible, based on distance traveled and rescues made.

The game features parallax background scrolling and progressively increases speed over time.

## Deploy on Vercel

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

*(The following sections are the default README content from `create-next-app`)*

## Getting Started

First, ensure you have Node.js and pnpm installed. Then, install the dependencies:

```bash
pnpm install
```

Next, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
