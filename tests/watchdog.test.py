import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('watchdog', Path(__file__).parents[1] / 'ops/watchdog.py')
watchdog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watchdog)


class WatchdogTests(unittest.TestCase):
    def test_publication_scope_excludes_credentials_and_monitor_permissions(self):
        watchdog.validate_paths(['site/app.js', 'analytics/server.mjs', '.github/workflows/pages.yml', 'package.json'])
        for name in ['.env', 'site/.env', 'site/secret.pem', '../other/file', 'ops/watchdog.py', 'AGENTS.md']:
            with self.assertRaises(RuntimeError):
                watchdog.validate_paths([name])

    def test_dirty_checkout_is_preserved_without_calling_codex(self):
        with patch.object(watchdog, 'changed_files', return_value=['site/app.js']), patch.object(watchdog, 'run') as run:
            with self.assertRaisesRegex(RuntimeError, 'uncommitted'):
                watchdog.repair()
            run.assert_not_called()

    def test_failed_pi_verification_restores_previous_release(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            source, hosting = base / 'source', base / 'hosting'
            for name in ['dist', 'analytics', 'scripts']:
                (source / name).mkdir(parents=True)
            (source / 'scripts/serve.mjs').write_text('// fixture')
            previous = hosting / 'releases/previous'
            previous.mkdir(parents=True)
            (hosting / 'current').symlink_to(previous)
            def run(args, **kwargs):
                if args[:2] == ['node', 'ops/healthcheck.mjs']:
                    raise RuntimeError('broken page')
                return 0, '1234567\n'
            with patch.object(watchdog, 'SOURCE', source), patch.object(watchdog, 'HOSTING', hosting), patch.object(watchdog, 'run', side_effect=run):
                with self.assertRaisesRegex(RuntimeError, 'restored the previous'):
                    watchdog.deploy_pi()
            self.assertEqual((hosting / 'current').resolve(), previous.resolve())


if __name__ == '__main__':
    unittest.main()
