// Gemeinsame Typen und Festlegungen des Flow-Baukastens (Entscheidungen Leif 12.11.: Schrift Inter Tight, Vektor-Zeiger, Glanz an).
import type React from 'react';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource-variable/inter/opsz.css';

/** Schrift für alle eigenen Inhalte. Die 1:1-Nachbauten (clips/) bleiben bei Inter – sie sind so vermessen. */
export const FONT = "'Inter Tight Variable', 'Inter Variable', system-ui, sans-serif";

/** Ein Objekt auf der Bühne (720 breit): linke obere Ecke, Größe, Eckenradius, Fläche; children liegen relativ zur Box. */
export type Box = {x: number; y: number; w: number; h: number; r?: number; bg?: string; children?: React.ReactNode};

/** Kamera-Stellung: Weltpunkt (x, y), der in der Bildmitte liegt, und Maßstab. */
export type Pose = {x: number; y: number; scale: number};
