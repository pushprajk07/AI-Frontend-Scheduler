# Submission notes: telemetry-compress (TB4)

## Before sending
1. Put your real name in `task.toml` (`author_name = "YOUR NAME"`).
2. Zip the `telemetry-compress/` folder, or attach the prepared `telemetry-compress.zip`.

## Email
**To:** eshu@adzzat.com, akshat.g@adzzat.com, plus@adzzat.com (all three in the same email)
**Subject:** TB4 (ROLLOUTS NOT DONE)
**Attachment:** telemetry-compress.zip

**Body:**

> Hi team,
>
> Please find attached my TB4 sample task, **telemetry-compress**.
>
> **Task:** the agent must write a lossless compressor/decompressor for a microservice's distributed-tracing logs. It must reach at least 33x compression (32x per file) on fresh, unseen logs from the same system; `xz -9e` reaches 8.6x. It must also round-trip any input exactly (empty, binary, damaged, truncated or concatenated logs) within 60 s per call, and keep no hidden state between runs.
>
> **Package contents:**
> - `instruction.md`, `task.toml`, `environment/` (Dockerfile plus the 4 training logs)
> - `solution/`: reference solution, a pure-Python context-modelling arithmetic coder that reaches 34.9x
> - `tests/`: verifier with an overall 0/1 reward plus a per-test 0/1 reward. Scoring logs are generated fresh at test time from a hidden generator.
> - `README.md`: the design argument for the task
> - a canary GUID in every file
>
> **Validation done (Docker):**
> - The reference solution passes all 6 tests.
> - Doing nothing fails all 6.
> - xz-only and simple column-split solutions fail the ratio tests.
>
> **Rollouts:** I did not run the official Harbor rollouts (no tokens). In one informal internal trial, a strong agent passed this task (about 41.7x). Please treat the difficulty as unconfirmed.
>
> **Originality:** I confirm this task is original. The task, data generator, reference solution and tests were created specifically for this submission and have never been published or used in any training or evaluation set.
>
> Thanks,
> [Your name]
