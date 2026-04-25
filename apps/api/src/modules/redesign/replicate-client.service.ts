import { Injectable } from '@nestjs/common';

import { EnvService } from '../../config/env.service';

export interface ReplicatePrediction {
  id: string;
  status: string;
  output?: unknown;
  /** Replicate may return a string or a structured object. */
  error?: unknown;
}

/**
 * Thin HTTP client for Replicate Predictions API. Never logs the API token.
 */
@Injectable()
export class ReplicateClient {
  constructor(private readonly env: EnvService) {}

  private baseUrl(): string {
    return this.env.get('REPLICATE_API_BASE_URL').replace(/\/+$/, '');
  }

  private bearer(): string {
    const t = this.env.get('REPLICATE_API_TOKEN');
    if (!t?.trim()) {
      throw new Error('REPLICATE_API_TOKEN is not configured');
    }
    return t.trim();
  }

  private async readFailureMessage(res: Response): Promise<string> {
    try {
      const text = await res.text();
      try {
        const j = JSON.parse(text) as { detail?: string; title?: string };
        if (typeof j.detail === 'string') return j.detail.slice(0, 2000);
        if (typeof j.title === 'string') return j.title.slice(0, 2000);
      } catch {
        /* not JSON */
      }
      return text.slice(0, 2000) || res.statusText;
    } catch {
      return res.statusText;
    }
  }

  async createPrediction(input: Record<string, unknown>): Promise<ReplicatePrediction> {
    const version = this.env.get('REPLICATE_MODEL_VERSION')?.trim();
    if (!version) {
      throw new Error('REPLICATE_MODEL_VERSION is not configured');
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.bearer()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ version, input }),
      });
    } catch (e: unknown) {
      throw new Error(`Network error calling Replicate API: ${String(e)}`);
    }

    if (!res.ok) {
      const msg = await this.readFailureMessage(res);
      if (res.status === 429) {
        throw new Error(`Replicate rate limited (429): ${msg}`);
      }
      if (res.status >= 500) {
        throw new Error(`Replicate server error (${res.status}): ${msg}`);
      }
      throw new Error(`Replicate prediction create failed (${res.status}): ${msg}`);
    }

    return (await res.json()) as ReplicatePrediction;
  }

  async getPrediction(id: string): Promise<ReplicatePrediction> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl()}/predictions/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.bearer()}`,
          Accept: 'application/json',
        },
      });
    } catch (e: unknown) {
      throw new Error(`Network error calling Replicate API: ${String(e)}`);
    }

    if (!res.ok) {
      const msg = await this.readFailureMessage(res);
      if (res.status === 429) {
        throw new Error(`Replicate rate limited (429): ${msg}`);
      }
      if (res.status >= 500) {
        throw new Error(`Replicate server error (${res.status}): ${msg}`);
      }
      throw new Error(`Replicate get prediction failed (${res.status}): ${msg}`);
    }

    return (await res.json()) as ReplicatePrediction;
  }
}
