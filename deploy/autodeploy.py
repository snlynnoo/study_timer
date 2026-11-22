#!/usr/bin/env python3
"""Pull successful GitHub Actions releases; no inbound deployment endpoint or SSH secret."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

REPOSITORY = 'snlynnoo/study_timer'
WORKFLOW = 'vps.yml'
ROOT = Path('/srv/study-timer')


def eligible_revision(run):
    """Only successful runs belonging to this repository's production branch qualify."""
    sha = run.get('head_sha', '')
    if (run.get('event') not in ('push', 'workflow_dispatch') or
            run.get('head_branch') != 'main' or
            run.get('status') != 'completed' or run.get('conclusion') != 'success' or
            (run.get('head_repository') or {}).get('full_name') != REPOSITORY or
            not re.fullmatch(r'[0-9a-f]{40}', sha)):
        return None
    return sha


def github_json(path):
    request = urllib.request.Request('https://api.github.com' + path, headers={
        'Accept': 'application/vnd.github+json', 'User-Agent': 'study-timer-vps-deployer',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def compose(directory, revision, *arguments):
    environment = os.environ.copy()
    environment['DEPLOY_REVISION'] = revision
    # Production options survive source updates and never enter the Git repository.
    command = ['docker', 'compose', '--project-directory', str(directory)]
    env_file = ROOT / 'production.env'
    if env_file.exists():
        command += ['--env-file', str(env_file)]
    command += ['-f', str(directory / 'compose.yaml'), *arguments]
    subprocess.run(command, env=environment, check=True)


def read_revision():
    marker = ROOT / 'DEPLOYED_REVISION'
    return marker.read_text().strip() if marker.exists() else ''


def verify_health():
    with urllib.request.urlopen('http://127.0.0.1:3001/api/health', timeout=10) as response:
        if json.load(response).get('status') != 'ok':
            raise RuntimeError('Production health check failed')


def deploy(revision):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Invalid deployment revision')
    previous_revision = read_revision()
    current = ROOT / 'app'
    previous_directory = current.resolve()
    releases = ROOT / 'releases'
    releases.mkdir(exist_ok=True)
    release = releases / revision
    if not release.exists():
        with tempfile.TemporaryDirectory(prefix='download-', dir=releases) as temporary:
            temporary = Path(temporary)
            archive = temporary / 'source.tar.gz'
            request = urllib.request.Request(
                f'https://codeload.github.com/{REPOSITORY}/tar.gz/{revision}',
                headers={'User-Agent': 'study-timer-vps-deployer'})
            with urllib.request.urlopen(request, timeout=60) as response, archive.open('wb') as output:
                shutil.copyfileobj(response, output)
            extraction = temporary / 'source'
            extraction.mkdir()
            with tarfile.open(archive) as source:
                source.extractall(extraction, filter='data')
            children = list(extraction.iterdir())
            if len(children) != 1 or not children[0].is_dir():
                raise RuntimeError('Unexpected source archive layout')
            children[0].rename(release)
    print(f'Building immutable release {revision}', flush=True)
    compose(release, revision, 'build', '--pull', 'app')
    if github_json(f'/repos/{REPOSITORY}/branches/main')['commit']['sha'] != revision:
        print('A newer main commit arrived during the build; leaving production unchanged.', flush=True)
        return
    # Keep a transactionally consistent backup of the live database before migrations.
    compose(previous_directory, previous_revision, 'exec', '-T', 'app', 'node', 'server/backup.mjs')
    try:
        compose(release, revision, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '120')
        verify_health()
    except Exception:
        print('Release failed; restarting previous application image. Database retained.', flush=True)
        compose(previous_directory, previous_revision, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '120')
        raise
    # The original deployment was a directory. Preserve it before switching to release symlinks.
    if not current.is_symlink():
        legacy = releases / f'legacy-{previous_revision or int(time.time())}'
        current.rename(legacy)
    pending = ROOT / 'app-next'
    if pending.is_symlink():
        pending.unlink()
    pending.symlink_to(release, target_is_directory=True)
    pending.replace(current)
    marker = ROOT / 'DEPLOYED_REVISION.next'
    marker.write_text(revision + '\n')
    marker.replace(ROOT / 'DEPLOYED_REVISION')
    print(f'Deployed {revision}: https://studytimer.snlynnoo.dev', flush=True)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / '.deploy.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another deployment is running; skipping.')
            return
        runs = github_json(f'/repos/{REPOSITORY}/actions/workflows/{WORKFLOW}/runs?branch=main&status=success&per_page=1').get('workflow_runs', [])
        if not runs:
            print('No successful production workflow yet.')
            return
        revision = eligible_revision(runs[0])
        if not revision or revision == read_revision():
            print('No new validated production release.')
            return
        head = github_json(f'/repos/{REPOSITORY}/branches/main')['commit']['sha']
        if revision != head:
            print('Waiting for checks on the latest main commit; refusing an older release.')
            return
        failed_file = ROOT / 'LAST_FAILED_DEPLOYMENT.json'
        if failed_file.exists():
            failed = json.loads(failed_file.read_text())
            if failed.get('revision') == revision and time.time() - failed.get('time', 0) < 600:
                print('Waiting before retrying this failed release.')
                return
        try:
            deploy(revision)
        except Exception:
            failed_file.write_text(json.dumps({'revision': revision, 'time': time.time()}))
            raise
        if failed_file.exists():
            failed_file.unlink()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Deployment error: {error}', file=sys.stderr, flush=True)
        sys.exit(1)
