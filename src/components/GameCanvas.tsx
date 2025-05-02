'use client';

import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import localizationManager from '@/utils/LocalizationManager'; // Import the manager

// --- Preloader Scene --- 
class PreloaderScene extends Phaser.Scene {
    private progressBar!: Phaser.GameObjects.Graphics;
    private progressBox!: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: 'PreloaderScene' });
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Loading bar graphics
        this.progressBox = this.add.graphics();
        this.progressBox.fillStyle(0x222222, 0.8);
        this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        this.progressBar = this.add.graphics();

        // Loading text
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: { font: '20px monospace', color: '#ffffff' }
        });
        loadingText.setOrigin(0.5, 0.5);

        // Percentage text
        const percentText = this.make.text({
            x: width / 2,
            y: height / 2,
            text: '0%',
            style: { font: '18px monospace', color: '#ffffff' }
        });
        percentText.setOrigin(0.5, 0.5);

        // --- Register loader events --- 
        this.load.on('progress', (value: number) => {
            percentText.setText(parseInt(String(value * 100)) + '%');
            this.progressBar.clear();
            this.progressBar.fillStyle(0xffffff, 1);
            this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            console.log('Preloader complete, starting MainScene...');
            this.progressBar.destroy();
            this.progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            this.scene.start('MainScene');
        });

        // --- Load Assets Here --- 
        console.log('PreloaderScene preload');
        this.load.atlas('game_atlas', 'assets/game_atlas.png', 'assets/game_atlas.json');
        this.load.image('bg_layer1', 'assets/bg_layer1.png'); 
        this.load.image('bg_layer2', 'assets/bg_layer2.png'); 
        this.load.image('ground_layer', 'assets/ground_layer.png');
    }
}

// Define the main game scene
class MainScene extends Phaser.Scene {
    private player?: Phaser.Physics.Arcade.Sprite;
    private bgLayer1?: Phaser.GameObjects.TileSprite;
    private bgLayer2?: Phaser.GameObjects.TileSprite;
    private scoreText?: Phaser.GameObjects.Text;
    private rescuesText?: Phaser.GameObjects.Text; // For rescue count
    private score: number = 0;
    private rescues: number = 0; // Rescue counter
    private gameSpeed: number = 1;
    private speedIncreaseTimer?: Phaser.Time.TimerEvent;
    private obstacleSpawnTimer?: Phaser.Time.TimerEvent;
    private obstacles?: Phaser.Physics.Arcade.Group;
    private strays?: Phaser.Physics.Arcade.Group; // Group for stray animals
    private powerups?: Phaser.Physics.Arcade.Group; // Group for powerups
    private isGameOver: boolean = false;
    private isInvincible: boolean = false;
    private hasGoldCollar: boolean = false; // Flag for Gold Collar effect
    private isSlowMode: boolean = false; // Accessibility: Slow mode flag
    private slowModeMultiplier: number = 0.75; // Speed reduction factor
    private invincibilityTimer?: Phaser.Time.TimerEvent;
    private straySpawnTimer?: Phaser.Time.TimerEvent;
    private powerupSpawnTimer?: Phaser.Time.TimerEvent;

    private jumpVelocity: number = -700; // Was -500 
    private maxSpeedMultiplier: number = 2;
    private speedIncreaseInterval: number = 20000; // 20 seconds in ms
    private speedIncreaseFactor: number = 1.1; // 10%
    private obstacleInitialSpawnDelay: number = 2000; // ms
    private obstacleSpawnIntervalBase: number = 2500; // ms, will decrease with speed
    private obstacleVelocityXBase: number = -200; // pixels/sec, will increase with speed
    private obstacleTypes: string[] = ['obstacle_bench', 'obstacle_bush', 'obstacle_fountain']; // Updated obstacle types based on new assets
    private strayTypes: string[] = ['stray_dog_0', 'stray_cat_0']; // Was placeholder keys
    private straySpawnIntervalBase: number = 5000; // ms, average interval
    private rescuePoints: number = 50;
    private invincibilityDuration: number = 2000; // 2 seconds in ms
    private powerupTypes: string[] = ['powerup_red_pot']; // Was 'powerup_gold_collar'
    private powerupSpawnIntervalBase: number = 15000; // ms, average interval

    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // Assets are now loaded in PreloaderScene
        console.log('MainScene preload (should be empty or load scene-specific assets)');
    }

    create() {
        console.log('MainScene create');
        this.isGameOver = false;
        this.isInvincible = false;
        this.hasGoldCollar = false;
        this.isSlowMode = false; // Initialize slow mode

        // --- Parallax Background using TileSprites ---
        const { width, height } = this.scale;

        this.bgLayer1 = this.add.tileSprite(0, 0, width, height, 'bg_layer1')
            .setOrigin(0, 0)
            .setScrollFactor(0); // Stays fixed relative to camera
        this.bgLayer2 = this.add.tileSprite(0, 0, width, height, 'bg_layer2')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Scale the tile sprites' textures to fit the height
        const bg1Texture = this.textures.get('bg_layer1').getSourceImage();
        const bg2Texture = this.textures.get('bg_layer2').getSourceImage();
        if (bg1Texture) {
            this.bgLayer1.setTileScale(height / bg1Texture.height);
        }
        if (bg2Texture) {
            this.bgLayer2.setTileScale(height / bg2Texture.height);
        }

        // --- Ground ---
        // Use scaleY to potentially adjust ground size if needed, or keep fixed size
        const ground = this.physics.add.staticImage(width / 2, height - 10, 'ground_layer');
        ground.setSize(width, 20 * (height / this.bgLayer1.height)).setDisplaySize(width, 20 * (height / this.bgLayer1.height)); // Adjust ground height slightly based on bg scale
        ground.refreshBody();
        ground.setDepth(1); // Ensure ground is above furthest background layer

        // --- Player --- 
        const playerX = 100;
        const playerY = height - 100;
        this.player = this.physics.add.sprite(playerX, playerY, 'game_atlas', 'mascot_idle'); // Use frame name
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(false);
        this.player.setDepth(2); // Ensure player is above background and ground
        this.physics.add.collider(this.player, ground);

        // --- Player Animations ---
        this.anims.create({
            key: 'run',
            frames: this.anims.generateFrameNames('game_atlas', { prefix: 'mascot_run_', start: 0, end: 7 }),
            frameRate: 12, // Adjust frame rate as needed
            repeat: -1 // Loop indefinitely
        });

        // Play the run animation
        this.player.play('run', true);

        // --- Obstacles --- 
        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.handlePlayerObstacleCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        this.physics.add.collider(this.obstacles, ground);
        // Obstacles should be above background but potentially behind player
        // Setting depth dynamically in spawn or via group might be needed later

        // --- Strays --- 
        this.strays = this.physics.add.group();
        this.physics.add.overlap(this.player, this.strays, this.handlePlayerStrayOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        // Strays depth similar to obstacles

        // --- Powerups Group --- 
        this.powerups = this.physics.add.group();
        this.physics.add.overlap(this.player as Phaser.Physics.Arcade.Sprite, this.powerups, this.handlePlayerPowerupOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        // --- Input for Jump --- 
        this.input.on('pointerdown', () => this.jump());
        this.input.keyboard?.on('keydown-SPACE', () => this.jump());
        // Add keyboard toggle for Slow Mode (TEMP - replace with UI toggle later)
        this.input.keyboard?.on('keydown-S', () => this.toggleSlowMode());

        // --- Score & Rescues Display ---
        this.score = 0;
        this.rescues = 0;
        this.scoreText = this.add.text(16, 16, this.getLocalizedScoreText(), { 
            fontSize: '24px', color: '#ffffff' 
        }).setDepth(10);
        this.rescuesText = this.add.text(16, 48, this.getLocalizedRescuesText(), { 
            fontSize: '24px', color: '#ffffff' 
        }).setDepth(10);
        
        // --- Background Music ---
        // Start background music (looping)
        // this.sound.play('music_bg', { loop: true, volume: 0.5 }); // Disabled audio // Adjust volume

        // --- Timers --- 
        this.gameSpeed = 1;
        this.speedIncreaseTimer?.destroy();
        this.speedIncreaseTimer = this.time.addEvent({
            delay: this.speedIncreaseInterval,
            callback: this.increaseSpeed,
            callbackScope: this,
            loop: true
        });

        this.obstacleSpawnTimer?.destroy();
        this.obstacleSpawnTimer = this.time.addEvent({
            delay: this.obstacleInitialSpawnDelay, // Initial delay before first spawn
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: false // Spawn first obstacle, then set looping timer
        });

        // Stray spawn timer
        this.straySpawnTimer?.destroy();
        this.straySpawnTimer = this.time.addEvent({
            delay: this.straySpawnIntervalBase + Phaser.Math.Between(-1000, 1000), // Initial delay
            callback: this.spawnStray,
            callbackScope: this,
            loop: false // First spawn, then set looping timer
        });

        // Powerup spawn timer
        this.powerupSpawnTimer?.destroy();
        this.powerupSpawnTimer = this.time.addEvent({
            delay: this.powerupSpawnIntervalBase + Phaser.Math.Between(-5000, 5000), // Initial delay
            callback: this.spawnPowerup,
            callbackScope: this,
            loop: false // First spawn, then set looping timer
        });
    }

    spawnObstacle() {
        if (this.isGameOver) return;
        const typeIndex = Phaser.Math.Between(0, this.obstacleTypes.length - 1);
        const obstacleKey = this.obstacleTypes[typeIndex];
        const spawnX = this.scale.width + 100;
        const spawnY = this.scale.height - 20;
        
        // Get retrieves inactive or creates new
        const obstacle = this.obstacles?.get(spawnX, spawnY, 'game_atlas', obstacleKey) as Phaser.Physics.Arcade.Sprite;
        if (obstacle) {
             obstacle.setActive(true);
             obstacle.setVisible(true);
             obstacle.setOrigin(0.5, 1);
             this.physics.world.enable(obstacle); // Enable physics if retrieved inactive
             // Reset state for reused obstacles
             obstacle.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier());
             obstacle.setImmovable(true); 
             if (obstacle.body) {
                 (obstacle.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
                 // Reset potential physics states if necessary (e.g., angular velocity)
             }
             obstacle.setDepth(2);
             obstacle.clearTint(); // Ensure tint is cleared if reused
         }
         this.obstacleSpawnTimer?.destroy();
         this.obstacleSpawnTimer = this.time.addEvent({
             delay: (this.obstacleSpawnIntervalBase / this.getCurrentGameSpeedMultiplier()) + Phaser.Math.Between(-200, 200),
             callback: this.spawnObstacle,
             callbackScope: this,
             loop: false
         });
    }

    spawnStray() {
        if (this.isGameOver) return;
        const typeIndex = Phaser.Math.Between(0, this.strayTypes.length - 1);
        const strayKey = this.strayTypes[typeIndex];
        const spawnX = this.scale.width + Phaser.Math.Between(50, 150);
        const spawnY = this.scale.height - Phaser.Math.Between(30, 100);
        
        // Get retrieves inactive or creates new
        const stray = this.strays?.get(spawnX, spawnY, 'game_atlas', strayKey) as Phaser.Physics.Arcade.Sprite;
        if (stray) {
            stray.setActive(true);
            stray.setVisible(true);
            stray.setOrigin(0.5, 1);
            this.physics.world.enable(stray); // Enable physics if retrieved inactive
            // Reset state for reused strays
            stray.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier() * 0.2);
            if (stray.body) {
                (stray.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            }
            stray.setDepth(2);
            stray.clearTint(); // Ensure tint is cleared if reused
        }
        this.straySpawnTimer?.destroy();
        this.straySpawnTimer = this.time.addEvent({
            delay: (this.straySpawnIntervalBase / this.getCurrentGameSpeedMultiplier()) + Phaser.Math.Between(-1500, 1500),
            callback: this.spawnStray,
            callbackScope: this,
            loop: false
        });
    }

    spawnPowerup() {
        if (this.isGameOver) return;
        const powerupKey = this.powerupTypes[0]; // Assuming only one type for now
        const spawnX = this.scale.width + Phaser.Math.Between(100, 200);
        const spawnY = this.scale.height - Phaser.Math.Between(50, 200);
        
        // Get retrieves inactive or creates new
        const powerup = this.powerups?.get(spawnX, spawnY, 'game_atlas', powerupKey) as Phaser.Physics.Arcade.Sprite;
        if (powerup) {
            powerup.setActive(true);
            powerup.setVisible(true);
            this.physics.world.enable(powerup); // Enable physics if retrieved inactive
            // Reset state for reused powerups
            powerup.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier() * 0.5);
            if (powerup.body) {
                (powerup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            }
            powerup.setDepth(3);
            powerup.clearTint(); // Ensure tint is cleared if reused
        }
        this.powerupSpawnTimer?.destroy();
        this.powerupSpawnTimer = this.time.addEvent({
            delay: (this.powerupSpawnIntervalBase / this.getCurrentGameSpeedMultiplier()) + Phaser.Math.Between(-5000, 5000),
            callback: this.spawnPowerup,
            callbackScope: this,
            loop: false
        });
    }

    handlePlayerObstacleCollision(
        // _playerGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject,
        // _obstacleGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject
    ) {
        if (this.isGameOver || this.isInvincible) return;

        // Check for Gold Collar effect
        if (this.hasGoldCollar) {
            this.consumeGoldCollar();
            return;
        }

        // this.sound.play('sfx_hit'); // Disabled audio
        this.gameOver();
    }

    handlePlayerStrayOverlap(
        playerGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject,
        strayGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject
    ) {
        if (this.isGameOver || !strayGO.active) return;

        // Award points
        this.score += this.rescuePoints;
        // Update score text using localized format
        this.scoreText?.setText(this.getLocalizedScoreText());

        // Increment rescues
        this.rescues++;
        // Update rescues text using localized format
        this.rescuesText?.setText(this.getLocalizedRescuesText());

        // this.sound.play('sfx_rescue'); // Disabled audio // Play rescue sound

        // Deactivate instead of destroy
        this.strays?.killAndHide(strayGO as Phaser.GameObjects.GameObject);

        // Grant invincibility
        this.activateInvincibility();
    }

    handlePlayerPowerupOverlap(
        playerGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject,
        powerupGO: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.GameObjects.GameObject
    ) {
        if (this.isGameOver || !powerupGO.active) return;
        
        const powerupSprite = powerupGO as Phaser.Physics.Arcade.Sprite;
        const powerupKey = powerupSprite.frame.name; // Get frame name from the sprite

        // Deactivate instead of destroy
        this.powerups?.killAndHide(powerupSprite);

        // Activate specific powerup effect based on the collected frame name
        if (powerupKey === 'powerup_red_pot') { // Check for the red pot frame
            this.activateGoldCollar(); // Still activates Gold Collar effect
        } else if (powerupKey === 'powerup_treat_magnet') {
            // TODO: Implement Treat Magnet activation
            console.log('Collected Treat Magnet (Not Implemented)');
        }
        // Optional: Play powerup collection sound
        // this.sound.play('sfx_powerup');
    }

    activateInvincibility() {
        if (this.isInvincible) {
            // Reset timer if already invincible
            this.invincibilityTimer?.reset({
                delay: this.invincibilityDuration,
                callback: this.deactivateInvincibility,
                callbackScope: this,
            });
        } else {
            this.isInvincible = true;
            this.player?.setAlpha(0.5); // Visual indicator
            console.log("Player invincible!");

            this.invincibilityTimer = this.time.addEvent({
                delay: this.invincibilityDuration,
                callback: this.deactivateInvincibility,
                callbackScope: this,
            });
        }
    }

    deactivateInvincibility() {
        this.isInvincible = false;
        this.player?.setAlpha(1.0);
        console.log("Player no longer invincible.");
    }

    activateGoldCollar() {
        if (!this.hasGoldCollar) {
            this.hasGoldCollar = true;
            this.player?.setTint(0xffd700); // Gold tint as visual indicator
            console.log("Gold Collar activated!");
            // Optional: Timer for duration if it was temporary
        }
    }

    consumeGoldCollar() {
        if (this.hasGoldCollar) {
            this.hasGoldCollar = false;
            this.player?.clearTint(); // Remove visual indicator
            console.log("Gold Collar consumed!");
            // Optional: Play a specific sound for collar breaking
            // this.sound.play('sfx_collar_break');
        }
    }

    gameOver() {
        this.isGameOver = true;
        this.physics.pause();
        this.player?.setTint(0xff0000); // Indicate hit
        this.speedIncreaseTimer?.remove();
        this.obstacleSpawnTimer?.remove();
        this.straySpawnTimer?.remove(); 
        this.powerupSpawnTimer?.remove(); 
        this.invincibilityTimer?.remove();
        this.hasGoldCollar = false; 
        // Player tint is cleared below or remains red
        // this.sound.stopByKey('music_bg'); // Disabled audio

        const finalScore = Math.floor(this.score);
        const finalRescues = this.rescues;
        console.log(`Game Over! Score: ${finalScore}, Rescues: ${finalRescues}`);

        // --- End Screen UI --- 
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const buttonStyle = { fontSize: '32px', color: '#ffffff', backgroundColor: '#555555', padding: { x: 20, y: 10 } };
        const scoreStyle = { fontSize: '28px', color: '#ffffff' };
        // Define a specific style for the Join button
        const joinButtonStyle = { fontSize: '36px', color: '#ffffff', backgroundColor: '#007bff', padding: { x: 25, y: 15 } }; // Larger and blue

        // Semi-transparent background overlay (optional)
        this.add.rectangle(centerX, centerY, this.scale.width, this.scale.height, 0x000000, 0.7).setDepth(10);

        // Game Over Text
        this.add.text(centerX, centerY - 150, localizationManager.getTranslation('gameOver'), { 
            fontSize: '64px', color: '#ff0000' 
        }).setOrigin(0.5).setDepth(11);

        // Final Score Text
        this.add.text(centerX, centerY - 80, 
            localizationManager.getFormattedTranslation('finalScore', { score: finalScore }), 
            scoreStyle
        ).setOrigin(0.5).setDepth(11);

        // Final Rescues Text
        this.add.text(centerX, centerY - 40, 
            localizationManager.getFormattedTranslation('finalRescues', { rescues: finalRescues }), 
            scoreStyle
        ).setOrigin(0.5).setDepth(11);

        // Play Again Button
        const playAgainButton = this.add.text(centerX, centerY + 50, localizationManager.getTranslation('playAgain'), buttonStyle)
            .setOrigin(0.5)
            .setDepth(11)
            .setInteractive({ useHandCursor: true });

        playAgainButton.on('pointerdown', () => {
            console.log('Restarting scene...');
            this.player?.clearTint(); // Clear hit tint before restart
            this.scene.restart();
        });

        // Join Paw App Button
        const joinButton = this.add.text(centerX, centerY + 120, localizationManager.getTranslation('joinPawApp'), joinButtonStyle) // Use new style
            .setOrigin(0.5)
            .setDepth(11)
            .setInteractive({ useHandCursor: true });

        joinButton.on('pointerdown', () => {
            console.log('Redirecting to App Store...');
            this.triggerDeepLinkFlow();
        });
    }

    triggerDeepLinkFlow() {
        // URLs
        const iosStoreUrl = 'https://apps.apple.com/lv/app/paw-app/id6474899820?platform=iphone'; // Use provided link
        // const deepLink = 'pawapp://home'; // Old deeplink (removed)
        // const androidStoreUrl = 'https://play.google.com/store/apps/details?id=com.example.app'; // TODO: Replace if needed
        // const fallbackTimeout = 1500; // Timeout removed

        // Directly open the App Store link
        console.log('Redirecting to App Store...');
        window.location.href = iosStoreUrl;

        // Remove old deeplink and fallback logic
        /*
        window.location.href = deepLink;

        const fallbackTimer = setTimeout(() => {
            // Simplify UA check, avoid non-standard properties
            const ua = navigator.userAgent;
            if (/android/i.test(ua)) {
                console.log('Deep link failed (timeout), redirecting to Play Store...');
                window.location.href = androidStoreUrl;
            } else if (/iPad|iPhone|iPod/.test(ua)) { // Removed MSStream check
                console.log('Deep link failed (timeout), redirecting to App Store...');
                window.location.href = iosStoreUrl;
            } else {
                console.log('Deep link failed (timeout), fallback to generic store/web page...');
            }
        }, fallbackTimeout);

        const clearFallback = () => {
            clearTimeout(fallbackTimer);
            window.removeEventListener('blur', clearFallback);
            window.removeEventListener('pagehide', clearFallback);
            console.log('Deep link likely succeeded, cancelling store fallback.');
        };
        window.addEventListener('blur', clearFallback);
        window.addEventListener('pagehide', clearFallback); // For mobile
        */
    }

    jump() {
        if (this.isGameOver) return;
        if (this.player && this.player.body?.touching.down) {
            // this.sound.play('sfx_jump'); // Disabled audio // Play jump sound
            this.player.setVelocityY(this.jumpVelocity);
        }
    }

    increaseSpeed() {
        if (this.isGameOver) return;
        if (this.gameSpeed < this.maxSpeedMultiplier) {
            this.gameSpeed *= this.speedIncreaseFactor;
            console.log(`Base game speed increased to: ${this.gameSpeed.toFixed(2)}x`);
            // Update velocities based on the *new* effective speed
            this.updateExistingVelocities(); 
        }
    }

    update(time: number, delta: number) {
        if (this.isGameOver) return;
        const effectiveSpeed = this.getCurrentGameSpeedMultiplier();

        // --- Parallax Background Scrolling using TileSprites ---
        const scrollSpeedLayer1 = 0.25 * effectiveSpeed; // Adjust speed factor as needed
        const scrollSpeedLayer2 = 0.5 * effectiveSpeed; // Adjust speed factor as needed

        // Update tilePositionX for seamless scrolling
        if (this.bgLayer1) {
            this.bgLayer1.tilePositionX += scrollSpeedLayer1;
        }
        if (this.bgLayer2) {
            this.bgLayer2.tilePositionX += scrollSpeedLayer2;
        }

        // --- Score Update ---
        // Score increase might or might not be affected by slow mode - design decision
        // Currently using effective speed, so score increases slower in slow mode.
        this.score += delta * 0.01 * effectiveSpeed;
        this.scoreText?.setText(this.getLocalizedScoreText());
        // Rescues text updated in overlap handler

        // --- Object Cleanup (Use killAndHide for pooling) ---
        this.obstacles?.children.iterate((child) => {
            const obstacle = child as Phaser.Physics.Arcade.Sprite;
            if (obstacle && obstacle.active && obstacle.x < -obstacle.width) {
                this.obstacles?.killAndHide(obstacle);
            }
            return true;
        });
        this.strays?.children.iterate((child) => {
            const stray = child as Phaser.Physics.Arcade.Sprite;
            if (stray && stray.active && stray.x < -stray.width) {
                 this.strays?.killAndHide(stray);
            }
            return true;
        });
        this.powerups?.children.iterate((child) => {
            const powerup = child as Phaser.Physics.Arcade.Sprite;
            if (powerup && powerup.active && powerup.x < -powerup.width) {
                 this.powerups?.killAndHide(powerup);
            }
            return true;
        });
        
        // Other effects (speed lines, particles, camera shake) will be added here later
    }

    // Helper methods to get localized text
    getLocalizedScoreText(): string {
        return localizationManager.getFormattedTranslation('score', { score: Math.floor(this.score) });
    }

    getLocalizedRescuesText(): string {
        return localizationManager.getFormattedTranslation('rescues', { rescues: this.rescues });
    }

    // --- Helper to get current effective speed ---
    getCurrentGameSpeedMultiplier(): number {
        return this.gameSpeed * (this.isSlowMode ? this.slowModeMultiplier : 1);
    }

    toggleSlowMode() {
        this.isSlowMode = !this.isSlowMode;
        console.log(`Slow mode ${this.isSlowMode ? 'enabled' : 'disabled'}`);
        // Immediately update velocities of existing objects
        this.updateExistingVelocities(); 
    }

    updateExistingVelocities() {
        const effectiveSpeed = this.getCurrentGameSpeedMultiplier();
        this.obstacles?.children.iterate((child) => {
            const obstacle = child as Phaser.Physics.Arcade.Sprite;
            obstacle.setVelocityX(this.obstacleVelocityXBase * effectiveSpeed);
            return true;
        });
        this.strays?.children.iterate((child) => {
            const stray = child as Phaser.Physics.Arcade.Sprite;
            stray.setVelocityX(this.obstacleVelocityXBase * effectiveSpeed * 0.2);
            return true;
        });
        this.powerups?.children.iterate((child) => {
            const powerup = child as Phaser.Physics.Arcade.Sprite;
            powerup.setVelocityX(this.obstacleVelocityXBase * effectiveSpeed * 0.5);
            return true;
        });
    }
}

// Define the Phaser game configuration
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    parent: 'phaser-game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 750 }, // Was 750
            // Disable debug rendering
            debug: false, 
            // debug: process.env.NODE_ENV === 'development', 
        },
    },
    // Start with PreloaderScene, then MainScene
    scene: [PreloaderScene, MainScene],
    scale: {
        mode: Phaser.Scale.ScaleModes.RESIZE,
        autoCenter: Phaser.Scale.Center.CENTER_BOTH,
    },
    backgroundColor: '#2d2d2d',
};

// Use type alias for empty props object
// type GameCanvasProps = {};

const GameCanvas: React.FC = () => {
    const gameInstance = useRef<Phaser.Game | null>(null);
    const gameContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (gameInstance.current || !gameContainerRef.current) {
            return;
        }
        gameInstance.current = new Phaser.Game({ ...config, parent: gameContainerRef.current });
        return () => {
            gameInstance.current?.destroy(true);
            gameInstance.current = null;
        };
    }, []);

    return <div id="phaser-game-container" ref={gameContainerRef} style={{ width: '100%', height: '100%' }} />;
};

export default GameCanvas; 