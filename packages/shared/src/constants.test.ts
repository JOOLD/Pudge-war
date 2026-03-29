import { describe, it, expect } from "vitest";
import {
  PLAYER_MAX_HP, RESPAWN_TIME, HOOK_COOLDOWN, HOOK_DAMAGE,
  HOOK_STUN_DURATION, SPAWN_HEAL_RADIUS, SPAWN_HEAL_RATE,
  ROT_RADIUS, ROT_DAMAGE, ROT_SELF_DAMAGE,
  PHASE_DURATION, PHASE_COOLDOWN,
  DISMEMBER_RANGE, DISMEMBER_DAMAGE, DISMEMBER_DURATION, DISMEMBER_COOLDOWN,
  GOLD_PER_KILL, GOLD_PER_ASSIST, GOLD_PASSIVE_RATE, ASSIST_WINDOW,
  KILLS_TO_WIN, PLAYER_SPEED,
} from "./constants";

describe("Phase A constants", () => {
  it("PLAYER_MAX_HP should be 500", () => {
    expect(PLAYER_MAX_HP).toBe(500);
  });

  it("HOOK_DAMAGE should not be an instant kill (< PLAYER_MAX_HP)", () => {
    expect(HOOK_DAMAGE).toBeLessThan(PLAYER_MAX_HP);
    expect(HOOK_DAMAGE).toBe(150);
  });

  it("HOOK_STUN_DURATION should be 500ms", () => {
    expect(HOOK_STUN_DURATION).toBe(500);
  });

  it("HOOK_COOLDOWN should be 6000ms", () => {
    expect(HOOK_COOLDOWN).toBe(6000);
  });

  it("RESPAWN_TIME should be 5000ms", () => {
    expect(RESPAWN_TIME).toBe(5000);
  });

  it("KILLS_TO_WIN should be 15", () => {
    expect(KILLS_TO_WIN).toBe(15);
  });

  it("PLAYER_SPEED should remain 160", () => {
    expect(PLAYER_SPEED).toBe(160);
  });

  it("spawn healing constants should be defined", () => {
    expect(SPAWN_HEAL_RADIUS).toBe(100);
    expect(SPAWN_HEAL_RATE).toBe(20);
  });

  it("rot skill constants should be defined", () => {
    expect(ROT_RADIUS).toBe(80);
    expect(ROT_DAMAGE).toBe(30);
    expect(ROT_SELF_DAMAGE).toBe(10);
  });

  it("phase shift constants should be defined", () => {
    expect(PHASE_DURATION).toBe(1000);
    expect(PHASE_COOLDOWN).toBe(12000);
  });

  it("dismember constants should be defined", () => {
    expect(DISMEMBER_RANGE).toBe(40);
    expect(DISMEMBER_DAMAGE).toBe(80);
    expect(DISMEMBER_DURATION).toBe(2000);
    expect(DISMEMBER_COOLDOWN).toBe(10000);
  });

  it("gold constants should be defined", () => {
    expect(GOLD_PER_KILL).toBe(100);
    expect(GOLD_PER_ASSIST).toBe(50);
    expect(GOLD_PASSIVE_RATE).toBe(5);
    expect(ASSIST_WINDOW).toBe(10000);
  });
});
