# 🌟 Wonder Arcade

**A Hybrid Local/Remote Social Gaming Platform.**

> **COPYRIGHT NOTICE:**  
> Copyright © 2025 [Your Name/Company]. All Rights Reserved.  
> This source code is proprietary. Unauthorized copying, distribution, or modification of this software is strictly prohibited. See `CREDITS.md` for open-source license attributions.

---

## 🎮 Overview

Wonder Arcade is a browser-based party platform designed to bridge the gap between **Desktop/TV** and **Mobile Devices**. It allows 2-8 players to compete in rapid-fire minigames using a shared screen (Host) and their personal smartphones (Controllers).

Unlike typical web games, Wonder Arcade features a **Lag-Compensated Hybrid Input System**, allowing local keyboard players and remote mobile players to compete fairly in real-time physics games.

---

## ✨ Key Features

*   **Zero-App Entry:** Players join by scanning a QR code. No app store downloads required.
*   **Hybrid Multiplayer:** Supports Local (Keyboard) and Remote (Phone) players simultaneously.
*   **Lag Equalization:** The Host engine calculates network RTT and artificially delays local inputs to match mobile latency, ensuring fair competitive play.
*   **Dynamic Controller UI:** The phone screen transforms automatically based on the game context (Lobby Editor -> Big Button -> Virtual Touchpad).
*   **Session Persistence:** Mobile players can lock their screen or refresh the page and reconnect instantly without losing their score or identity.

---

## 🛠️ Technical Architecture

The engine is built on a custom **Manager-Pattern Architecture** using vanilla ES6 JavaScript.

| Core Component | Responsibility |
| :--- | :--- |
| **`GameRunner.js`** | The central loop. Manages the active P5.js instance, switches between `DEMO` (AI) and `ACTIVE` modes, and handles rendering lifecycles. |
| **`NetworkManager.js`** | Manages WebRTC connections via **PeerJS**. Handles the Heartbeat loop, Zombie Player detection (45s timeout), and Packet Routing. |
| **`InputManager.js`** | The input funnel. Normalizes Keyboard and WebRTC inputs into a single stream. Applies `systemLag` to local inputs for fairness. |
| **`BaseGame.js`** | The parent class for all minigames. Handles scaling (`1920x1200` virtual canvas), score tracking, turn management, and virtual cursor physics. |

### Tech Stack
*   **Rendering:** [p5.js](https://p5js.org/) (LGPL-2.1)
*   **Physics:** [Matter.js](https://brm.io/matter-js/) (MIT)
*   **Networking:** [PeerJS](https://peerjs.com/) (MIT)
*   **Utilities:** [QRCode.js](https://davidshimjs.github.io/qrcodejs/) (MIT)

---

## 🎨 Design Philosophy

Our goal is to create a **Visually Unified and Accessible** experience for players aged 5 to 95.

### I. The Core Experience
| Principle | Implementation |
| :--- | :--- |
| **Accessibility First** | Games utilize either **One Button** (Twitch/Rhythm) or **Virtual Touchpad** (Mouse-likes). Complex inputs are strictly forbidden. |
| **Zero Confusion** | Each player is permanently associated with their **Color + Avatar** across the Lobby, Controller, and In-Game Cursors. |
| **Generational Balance** | Mechanics prioritize timing and chaos over complex strategy, allowing children to compete genuinely against adults. |

### II. The Visual Blueprint
| Component | Implementation |
| :--- | :--- |
| **Art Style** | **Vector Pop:** Clean lines, high-contrast colors, procedural animation. No bitmaps. |
| **Avatars** | **Expressive Identity:** Custom blocky characters that react (`Happy`, `Sad`, `Stunned`) based on game events. |
| **Lobby UI** | **Live Preview:** The Lobby acts as a character creator with real-time syncing between Phone and TV. |

---

## 🕹️ Game Registry

New games are added via `src/GameRegistry.js`.

1.  **Sumo Discs:** Physics-based sumo wrestling.
2.  **Hop Hero:** Frogger-style rhythm crossing.
3.  **Bomb Tag:** Hot potato with rising tension.
4.  **Crate Stackers:** Physics tower building (Turn-Based).
5.  **Avatar Match:** Memory card game using Virtual Cursors.
6.  **Code Breaker:** Logic deduction game.
7.  **Red Light, Green Light:** Reaction time racer.
8.  **Ninja Reflex:** Millisecond precision test.
9.  **Paint Party:** Grid-based territory control.

---

## 📄 License & Credits

This project source code is **Proprietary**.
See `CREDITS.md` for a full list of open-source libraries used and their respective licenses.
