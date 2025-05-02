'use client';

import React, { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import localizationManager from '@/utils/LocalizationManager'; // Import the manager

// Define base game size for consistent positioning
const BASE_WIDTH = 1024;
const BASE_HEIGHT = 576; // 16:9 aspect ratio

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

    // Keep jump/speed variables
    private jumpVelocity: number = -700; // Was -500 
    private maxSpeedMultiplier: number = 2;
    private speedIncreaseInterval: number = 20000; // 20 seconds in ms
    private speedIncreaseFactor: number = 1.1; // 10%
    private obstacleInitialSpawnDelay: number = 2000; // ms
    private obstacleSpawnIntervalBase: number = 2500; // ms, will decrease with speed
    private obstacleVelocityXBase: number = -200; // pixels/sec, will increase with speed
    private obstacleTypes: string[] = ['obstacle_bench', 'obstacle_bush', 'obstacle_fountain'];
    private strayTypes: string[] = ['stray_dog_0', 'stray_cat_0'];
    private straySpawnIntervalBase: number = 5000; // ms, average interval
    private rescuePoints: number = 50;
    private invincibilityDuration: number = 2000; // 2 seconds in ms
    private powerupTypes: string[] = ['powerup_red_pot'];
    private powerupSpawnIntervalBase: number = 15000; // ms, average interval

    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        console.log('MainScene preload');
    }

    create() {
        console.log('MainScene create');
        this.isGameOver = false;
        this.isInvincible = false;
        this.hasGoldCollar = false;
        this.isSlowMode = false;
        
        // Use BASE_WIDTH and BASE_HEIGHT for positioning
        const width = BASE_WIDTH;
        const height = BASE_HEIGHT;

        // --- Parallax Background using TileSprites --- 
        this.bgLayer1 = this.add.tileSprite(0, 0, width, height, 'bg_layer1')
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.bgLayer2 = this.add.tileSprite(0, 0, width, height, 'bg_layer2')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Scale textures based on BASE_HEIGHT
        const bg1Texture = this.textures.get('bg_layer1').getSourceImage();
        const bg2Texture = this.textures.get('bg_layer2').getSourceImage();
        if (bg1Texture) {
            this.bgLayer1.setTileScale(height / bg1Texture.height);
        }
        if (bg2Texture) {
            this.bgLayer2.setTileScale(height / bg2Texture.height);
        }

        // --- Ground --- 
        // Position relative to BASE_HEIGHT
        const groundYPosition = height - 10; // Position near bottom of base height
        const groundDisplayHeight = 60 * (height / (bg1Texture?.height || height)); // Calculate based on base height
        const ground = this.physics.add.staticImage(width / 2, groundYPosition, 'ground_layer');
        ground.setSize(width, groundDisplayHeight).setDisplaySize(width, groundDisplayHeight);
        ground.refreshBody();
        ground.setDepth(1); // Ensure ground is above furthest background layer
        console.log(`Ground Y: ${ground.y}, Ground Display Height: ${ground.displayHeight}`);

        // --- Player --- 
        // Position relative to BASE_HEIGHT and ground
        const playerX = 100;
        const playerY = height - (groundDisplayHeight + 50); // Position above the calculated ground height
        this.player = this.physics.add.sprite(playerX, playerY, 'game_atlas', 'mascot_run_0'); // Start with run frame
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(false); // We need world bounds if using fixed size
        this.player.setDepth(2);
        this.physics.add.collider(this.player, ground);
        console.log(`Player Y: ${this.player.y}`);

        // Set physics world bounds based on BASE dimensions
        this.physics.world.setBounds(0, 0, width, height);
        this.cameras.main.setBounds(0, 0, width, height); // Ensure camera matches world

        // --- Player Animations ---
        this.anims.create({
            key: 'run',
            frames: this.anims.generateFrameNames('game_atlas', { prefix: 'mascot_run_', start: 0, end: 7 }),
            frameRate: 12, // Adjust frame rate as needed
            repeat: -1 // Loop indefinitely
        });
        this.player.play('run', true);

        // --- Obstacles --- 
        this.obstacles = this.physics.add.group();
        this.physics.add.collider(this.player, this.obstacles, this.handlePlayerObstacleCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);
        this.physics.add.collider(this.obstacles, ground);

        // --- Strays --- 
        this.strays = this.physics.add.group();
        this.physics.add.overlap(this.player, this.strays, this.handlePlayerStrayOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        // --- Powerups Group --- 
        this.powerups = this.physics.add.group();
        this.physics.add.overlap(this.player as Phaser.Physics.Arcade.Sprite, this.powerups, this.handlePlayerPowerupOverlap as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback, undefined, this);

        // --- Input for Jump --- 
        this.input.on('pointerdown', () => this.jump());
        this.input.keyboard?.on('keydown-SPACE', () => this.jump());
        this.input.keyboard?.on('keydown-S', () => this.toggleSlowMode());

        // --- Score & Rescues Display --- 
        this.score = 0;
        this.rescues = 0;
        // Use fixed text size appropriate for BASE resolution
        const textSize = '24px'; // Fixed size
        const textPadding = 16; // Fixed padding
        this.scoreText = this.add.text(textPadding, textPadding, this.getLocalizedScoreText(), { 
            fontSize: textSize, color: '#ffffff' 
        }).setDepth(10).setScrollFactor(0); // Keep score fixed on screen
        this.rescuesText = this.add.text(textPadding, 48, this.getLocalizedRescuesText(), { 
            fontSize: textSize, color: '#ffffff' 
        }).setDepth(10).setScrollFactor(0); // Keep rescues fixed on screen
        
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
        // Spawn relative to BASE_WIDTH and ground position
        const spawnX = BASE_WIDTH + 100;
        // Ensure obstacle Y position aligns with the ground level
        const groundY = BASE_HEIGHT - 10; // Align with ground Y position
        const obstacle = this.obstacles?.get(spawnX, groundY, 'game_atlas', obstacleKey) as Phaser.Physics.Arcade.Sprite;
        if (obstacle) {
             obstacle.setActive(true);
             obstacle.setVisible(true);
             obstacle.setOrigin(0.5, 1); // Origin at bottom-center
             this.physics.world.enable(obstacle);
             obstacle.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier());
             obstacle.setImmovable(true); 
             if (obstacle.body) {
                 (obstacle.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
             }
             obstacle.setDepth(2);
             obstacle.clearTint();
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
        // Spawn relative to BASE_WIDTH and ground position
        const spawnX = BASE_WIDTH + Phaser.Math.Between(50, 150);
        const groundY = BASE_HEIGHT - 10; // Align with ground Y position
        const spawnY = groundY - Phaser.Math.Between(5, 40); // Slightly above ground
        const stray = this.strays?.get(spawnX, spawnY, 'game_atlas', strayKey) as Phaser.Physics.Arcade.Sprite;
        if (stray) {
            stray.setActive(true);
            stray.setVisible(true);
            stray.setOrigin(0.5, 1); // Origin at bottom-center
            this.physics.world.enable(stray);
            stray.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier() * 0.2);
            if (stray.body) {
                (stray.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            }
            stray.setDepth(2);
            stray.clearTint();
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
        const powerupKey = this.powerupTypes[0];
        // Spawn relative to BASE_WIDTH and a random height
        const spawnX = BASE_WIDTH + Phaser.Math.Between(100, 200);
        const spawnY = BASE_HEIGHT - Phaser.Math.Between(50, 200); // Random height from bottom
        const powerup = this.powerups?.get(spawnX, spawnY, 'game_atlas', powerupKey) as Phaser.Physics.Arcade.Sprite;
        if (powerup) {
            powerup.setActive(true);
            powerup.setVisible(true);
            this.physics.world.enable(powerup);
            powerup.setVelocityX(this.obstacleVelocityXBase * this.getCurrentGameSpeedMultiplier() * 0.5);
            if (powerup.body) {
                (powerup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
            }
            powerup.setDepth(3);
            powerup.clearTint();
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

        // --- End Screen UI positioned relative to BASE dimensions --- 
        const centerX = BASE_WIDTH / 2;
        const centerY = BASE_HEIGHT / 2;
        
        // Use fixed font sizes appropriate for BASE resolution
        const titleSize = '64px';
        const scoreSize = '28px';
        const buttonTextSize = '32px';
        const joinButtonTextSize = '36px';
        
        // Use fixed button offsets
        const buttonYOffset = 50;
        const joinButtonYOffset = 120;
        
        const buttonStyle = { 
            fontSize: buttonTextSize, 
            color: '#ffffff', 
            backgroundColor: '#555555', 
            padding: { x: 20, y: 10 },
            shadow: { color: '#000000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        };
        
        const scoreStyle = { 
            fontSize: scoreSize, 
            color: '#ffffff',
            shadow: { color: '#000000', fill: true, offsetX: 1, offsetY: 1, blur: 2 } 
        };
        
        // Define a specific style for the Join button
        const joinButtonStyle = { 
            fontSize: joinButtonTextSize, 
            color: '#ffffff', 
            backgroundColor: '#007bff', 
            padding: { x: 25, y: 15 },
            shadow: { color: '#000000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        };

        // Add elements relative to centerX, centerY
        this.add.rectangle(centerX, centerY, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.7).setDepth(10).setScrollFactor(0);
        this.add.text(centerX, centerY - 150, localizationManager.getTranslation('gameOver'), { 
            fontSize: titleSize, 
            color: '#ff0000',
            shadow: { color: '#000000', fill: true, offsetX: 2, offsetY: 2, blur: 5 }
        }).setOrigin(0.5).setDepth(11).setScrollFactor(0);

        // Final Score Text
        this.add.text(centerX, centerY - 80, 
            localizationManager.getFormattedTranslation('finalScore', { score: finalScore }), 
            scoreStyle
        ).setOrigin(0.5).setDepth(11).setScrollFactor(0);

        // Final Rescues Text
        this.add.text(centerX, centerY - 40, 
            localizationManager.getFormattedTranslation('finalRescues', { rescues: finalRescues }), 
            scoreStyle
        ).setOrigin(0.5).setDepth(11).setScrollFactor(0);

        // Play Again Button
        const playAgainButton = this.add.text(centerX, centerY + buttonYOffset, localizationManager.getTranslation('playAgain'), buttonStyle)
            .setOrigin(0.5)
            .setDepth(11)
            .setPadding(15, 10, 15, 10)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0);

        playAgainButton.on('pointerdown', () => {
            console.log('Restarting scene...');
            this.player?.clearTint(); // Clear hit tint before restart
            this.scene.restart();
        });

        // Join Paw App Button - Mobile optimized
        const joinButton = this.add.text(centerX, centerY + joinButtonYOffset, localizationManager.getTranslation('joinPawApp'), joinButtonStyle)
            .setOrigin(0.5)
            .setDepth(11)
            .setPadding(20, 15, 20, 15)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0);

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

        // --- Background Scrolling --- 
        // Speed calculation is fine
        const scrollSpeedLayer1 = 0.25 * effectiveSpeed;
        const scrollSpeedLayer2 = 0.5 * effectiveSpeed;
        if (this.bgLayer1) { this.bgLayer1.tilePositionX += scrollSpeedLayer1; }
        if (this.bgLayer2) { this.bgLayer2.tilePositionX += scrollSpeedLayer2; }

        // --- Score Update --- 
        this.score += delta * 0.01 * effectiveSpeed;
        // Score text update is fine (already setScrollFactor(0))
        this.scoreText?.setText(this.getLocalizedScoreText());

        // --- Object Cleanup --- 
        // Logic remains the same, checks position relative to object width
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

// Define the Phaser game configuration using BASE dimensions
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: BASE_WIDTH, // Use base width
    height: BASE_HEIGHT, // Use base height
    parent: 'phaser-game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 770 },
            debug: false, 
        },
    },
    scene: [PreloaderScene, MainScene],
    scale: {
        // Try WIDTH_CONTROLS_HEIGHT mode
        mode: Phaser.Scale.ScaleModes.WIDTH_CONTROLS_HEIGHT, // Was FIT
        autoCenter: Phaser.Scale.Center.CENTER_BOTH,
    },
    backgroundColor: '#2d2d2d',
    input: {
        activePointers: 2, // Support for multi-touch
        touch: {
            capture: true,
        }
    },
    dom: {
        createContainer: true
    },
};

// Use type alias for empty props object
// type GameCanvasProps = {};

const GameCanvas: React.FC = () => {
    const gameInstance = useRef<Phaser.Game | null>(null);
    const gameContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Add viewport meta tags for mobile if they don't exist
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            document.head.appendChild(meta);
        }
        
        // Add touch-specific meta tags for iOS
        if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
            const meta = document.createElement('meta');
            meta.name = 'apple-mobile-web-app-capable';
            meta.content = 'yes';
            document.head.appendChild(meta);
        }

        if (gameInstance.current || !gameContainerRef.current) {
            return;
        }
        gameInstance.current = new Phaser.Game({ ...config, parent: gameContainerRef.current });

        // Remove explicit resize handler for now
        /*
        const handleResize = () => {
            if (gameInstance.current && gameInstance.current.scale) {
                gameInstance.current.scale.refresh();
            }
        };
        window.addEventListener('resize', handleResize);
        */

        return () => {
            // window.removeEventListener('resize', handleResize);
            gameInstance.current?.destroy(true);
            gameInstance.current = null;
        };
    }, []);

    // Minimal container styling, let Phaser handle scaling
    return <div id="phaser-game-container" ref={gameContainerRef} style={{ 
        width: '100%', 
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        // Add overflow visible just in case
        overflow: 'visible',
        // Ensure no extra overflow or sizing rules interfere
        // touchAction: 'none' // Keep touch action prevention
    }} />;
};

export default GameCanvas; 