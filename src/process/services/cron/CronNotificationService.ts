/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chatLib';
import { extractTextFromMessage } from '@/process/task/MessageMiddleware';
import { BrowserWindow, Notification, app } from 'electron';
import { getDatabase } from '../../database';

export interface CronExecutionNotificationPayload {
  jobId: string;
  conversationId: string;
  conversationTitle?: string;
  status: 'ok' | 'error' | 'skipped';
  error?: string;
  triggerMsgId?: string;
  executedAtMs?: number;
}

const MAX_WAIT_MS = 8000;
const POLL_INTERVAL_MS = 700;
const TITLE_MAX_LENGTH = 56;
const BODY_MAX_LENGTH = 220;

class CronNotificationService {
  private activeNotifications = new Set<Notification>();

  async notifyExecution(payload: CronExecutionNotificationPayload): Promise<void> {
    if (payload.status !== 'ok') {
      return;
    }

    const replyText = await this.collectReplyText(payload);
    if (!this.isValidReply(replyText)) {
      return;
    }

    const { title, body } = this.buildNotificationContent(replyText);

    try {
      const notification = new Notification({
        title,
        body,
        silent: false,
      });

      // Keep reference to avoid premature GC on some platforms.
      this.activeNotifications.add(notification);

      const cleanup = () => {
        this.activeNotifications.delete(notification);
      };

      notification.on('click', () => {
        this.focusMainWindow();
        ipcBridge.cron.openExecution.emit({
          conversationId: payload.conversationId,
          msgId: payload.triggerMsgId,
        });
        cleanup();
      });

      notification.on('close', cleanup);
      notification.on('failed', cleanup);

      notification.show();
    } catch {
      // Ignore notification errors to keep cron execution path unaffected.
    }
  }

  private focusMainWindow(): void {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) {
      return;
    }

    if (win.isMinimized()) {
      win.restore();
    }

    if (!win.isVisible()) {
      win.show();
    }

    app.focus({ steal: true });
    win.focus();
  }

  private async collectReplyText(payload: CronExecutionNotificationPayload): Promise<string> {
    const startAt = Date.now();
    let lastText = '';
    let stableRounds = 0;

    while (Date.now() - startAt <= MAX_WAIT_MS) {
      const currentText = this.findBestReplyText(payload);
      if (currentText) {
        if (currentText === lastText) {
          stableRounds += 1;
        } else {
          lastText = currentText;
          stableRounds = 0;
        }

        if (stableRounds >= 1) {
          return currentText;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return lastText;
  }

  private findBestReplyText(payload: CronExecutionNotificationPayload): string {
    const db = getDatabase();

    if (payload.triggerMsgId) {
      const directResult = db.getMessageByMsgId(payload.conversationId, payload.triggerMsgId, 'text');
      if (directResult.success && directResult.data && directResult.data.position === 'left') {
        const text = this.cleanText(this.extractReadableContent(directResult.data));
        if (text) {
          return text;
        }
      }
    }

    const recentResult = db.getConversationMessages(payload.conversationId, 0, 40, 'DESC');
    const minTime = (payload.executedAtMs || Date.now()) - 20000;

    for (const message of recentResult.data) {
      if (message.position !== 'left') {
        continue;
      }

      if ((message.createdAt || 0) < minTime) {
        continue;
      }

      const text = this.cleanText(this.extractReadableContent(message));
      if (text) {
        return text;
      }
    }

    return '';
  }

  private buildNotificationContent(rawText: string): { title: string; body: string } {
    const normalized = this.cleanText(rawText);
    const lines = normalized
      .split(/(?<=[。！？.!?])\s+|\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const titleSource = lines[0] || normalized;
    const title = this.truncate(titleSource, TITLE_MAX_LENGTH);

    const bodySource = lines.length > 1 ? lines.slice(0, 3).join(' ') : normalized;
    const body = this.truncate(bodySource, BODY_MAX_LENGTH);

    return { title, body };
  }

  private cleanText(text: string): string {
    if (!text) {
      return '';
    }

    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#>*_~-]{1,3}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isValidReply(text: string): boolean {
    const value = this.cleanText(text);
    if (!value || value.length < 1) {
      return false;
    }

    const lower = value.toLowerCase();
    const placeholders = ['ok', 'done', 'completed', '处理完成', '已完成', '完成'];
    return !placeholders.some((item) => lower === item);
  }

  private extractReadableContent(message: TMessage): string {
    if (message.type === 'text' || message.type === 'tips') {
      return extractTextFromMessage(message);
    }

    if (message.type === 'tool_group' && Array.isArray(message.content)) {
      return message.content
        .map((item) => {
          const name = item.name || item.description || 'tool';
          const result = typeof item.resultDisplay === 'string' ? item.resultDisplay : '';
          return [name, result].filter(Boolean).join(': ');
        })
        .filter(Boolean)
        .join(' ; ');
    }

    if (message.type === 'tool_call' && message.content) {
      const name = message.content.name || '';
      const error = message.content.error || '';
      return [name, error].filter(Boolean).join(' ');
    }

    if (message.type === 'codex_tool_call' && message.content) {
      const title = message.content.title || message.content.description || '';
      const output = Array.isArray(message.content.content)
        ? message.content.content
            .map((item) => item.output || item.text || '')
            .filter(Boolean)
            .join(' ')
        : '';
      return [title, output].filter(Boolean).join(' ');
    }

    if (message.type === 'acp_tool_call' && message.content) {
      const update = message.content.update;
      if (update?.title) {
        return update.title;
      }
    }

    if (message.type === 'plan' && message.content) {
      return message.content.entries
        .map((entry) => entry.content)
        .filter(Boolean)
        .join(' ; ');
    }

    return '';
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) {
      return text;
    }

    return `${text.slice(0, max - 1)}...`;
  }
}

export const cronNotificationService = new CronNotificationService();
