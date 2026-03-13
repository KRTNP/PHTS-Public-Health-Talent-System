import { OpsJobRunsRepository, type OpsJobRunStatus } from '@/modules/system/repositories/ops-job-runs.repository.js';

export type TrackedJobResult = {
  status?: Exclude<OpsJobRunStatus, 'RUNNING' | 'FAILED'>;
  summary?: unknown;
};

export class OpsJobRunService {
  static async runTrackedJob(input: {
    jobKey: string;
    triggerSource: string;
    handler: () => Promise<TrackedJobResult | void>;
  }): Promise<TrackedJobResult> {
    const jobRunId = await OpsJobRunsRepository.createRun({
      jobKey: input.jobKey,
      triggerSource: input.triggerSource,
    });

    try {
      const result = (await input.handler()) ?? {};
      const status = result.status ?? 'SUCCESS';
      await OpsJobRunsRepository.finishRun({
        jobRunId,
        status,
        summary: result.summary,
      });
      return { status, summary: result.summary };
    } catch (error) {
      await OpsJobRunsRepository.finishRun({
        jobRunId,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
