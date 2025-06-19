# Star AI - Digital Human Platform

[简体中文](./README.md) | [English](./README_en.md)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28.0-47848f?logo=electron)](https://www.electronjs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

**Star AI Digital Human (xjaigc)** is a powerful AI digital human SaaS system that supports private deployment. It integrates industry-leading AI models to provide a one-stop digital human solution for individual and enterprise users.

Our vision is to enable everyone to easily own and use their own digital avatar.

## ✨ Core Features

- **Text-to-Speech (TTS)**: Input text, choose from various voices, and quickly generate high-quality speech.
- **Voice Clone**: Clone anyone's voice with just 5-30 seconds of reference audio to synthesize speech for new text.
- **Video Lip-Sync**: Upload a character video and audio to generate a digital human video with precise lip-sync.
- **Model Hot-Swapping**: Supports dynamic loading and unloading of AI models at runtime without restarting the application.
- **Custom Model Integration**: Supports simple integration, allowing developers to quickly integrate custom AI models with just a configuration file and a Python script.

## 🏗️ Technical Architecture

This application uses a modern desktop application architecture with a separation of front-end and back-end, ensuring high maintainability and scalability.

- **Desktop Framework**: Electron
- **Front-end Stack**: Vue3 + TypeScript + Vite
- **UI Framework**: Arco Design Vue
- **State Management**: Pinia
- **AI Model Services**: Managed via child processes, supporting both built-in TS services and custom Python services.

## 🚀 Quick Start

1.  **Clone the project**
    ```bash
    git clone https://github.com/ryonWang/xjaigc.git
    cd xjaigc
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the application**
    ```bash
    npm run dev
    ```

## 🤖 Model Integration

We offer two flexible ways to integrate models:

1.  **Built-in Services**: Deeply integrated with TypeScript for core official models, providing optimal performance.
2.  **EasyServer**: A minimal Python script solution for community and custom models, with a low development barrier.

## 🤝 Contributing

We welcome all forms of contributions! Whether it's submitting bugs, suggesting new features, or contributing code, it's crucial for the project.

## 🗓️ Roadmap

We are planning the following new features to continuously enhance the product's capabilities:

- [👉] **B/S Resource Integration**: Connect with server-side public resource libraries, including videos, model templates, etc.
- [👉] **Live Streaming Functionality**: Integrate live streaming capabilities to support real-time digital human broadcasts.
- [👉] **Scripts and Corpus**: Built-in and custom script/corpus templates to improve content creation efficiency.
- [👉] **Scene Decoration**: Provide backgrounds, stickers, props, and other assets for short videos and live streams to enrich visual effects.
- [👉] **Educational Digital Human**: Explore a separate version for the education sector, providing a digital human course and PPT creation system.

## 📸 Application Screenshots

(Screenshots will be re-uploaded later)

<!--
![Star AI Digital Human-screenshot-en-1](screenshots/en/screenshot-1.png)
![Star AI Digital Human-screenshot-en-2](screenshots/en/screenshot-2.png)
![Star AI Digital Human-screenshot-en-3](screenshots/en/screenshot-3.png)
![Star AI Digital Human-screenshot-en-4](screenshots/en/screenshot-4.png)
![Star AI Digital Human-screenshot-en-5](screenshots/en/screenshot-5.png)
-->

## License

[Apache-2.0](./LICENSE) License.

Copyright © 2023-2024 [xjaigc](https://github.com/ryonWang/xjaigc) 