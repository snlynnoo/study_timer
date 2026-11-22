import unittest
from autodeploy import eligible_revision, REPOSITORY


class ProductionGateTests(unittest.TestCase):
    def setUp(self):
        self.run = {'head_sha': 'a' * 40, 'event': 'push', 'head_branch': 'main',
                    'status': 'completed', 'conclusion': 'success',
                    'head_repository': {'full_name': REPOSITORY}}

    def test_successful_production_push(self):
        self.assertEqual(eligible_revision(self.run), 'a' * 40)

    def test_failed_pending_fork_and_pull_request_runs_cannot_deploy(self):
        for change in [{'event': 'pull_request'}, {'head_branch': 'feature'},
                       {'status': 'in_progress'}, {'conclusion': 'failure'},
                       {'head_repository': {'full_name': 'someone/fork'}},
                       {'head_repository': None}, {'head_sha': '../../bad'}]:
            with self.subTest(change=change):
                self.assertIsNone(eligible_revision({**self.run, **change}))


if __name__ == '__main__':
    unittest.main()
