"""Offline regression cases only. No source requests."""
from pathlib import Path
from types import SimpleNamespace
import sys, logging
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pipeline'))
from wave_provider_status import WaveStatusCapture, warning_boundary, DATASET
text = f"The dataset {DATASET}, version '202311', part 'default' is currently being updated. Data after 2026-11-26T00:00:00.000Z may not be up to date."
c = WaveStatusCapture()
c.emit(logging.LogRecord('copernicusmarine', logging.WARNING, '', 0, text, (), None))
a = c.status('2026-11-27T04:07:27+02:00')
assert a['state'] == 'updating'
assert a['affected_after_utc'] == '2026-11-26T00:00:00.000Z'
assert 'not proof' in a['meaning']
assert warning_boundary(text.replace(DATASET, 'another_dataset')) is None
assert warning_boundary('HTTP success') is None
assert warning_boundary(f'{DATASET} currently being updated but no boundary') is None
assert c.status('later')['state'] == 'updating'
new = WaveStatusCapture()
assert new.status('later', a) == a
assert new.status('later')['state'] == 'unknown'
def dataset(boundary, updated):
    part = SimpleNamespace(arco_updating_start_date=boundary, arco_updated_date=updated)
    return SimpleNamespace(dataset_id=DATASET, get_version=lambda _: SimpleNamespace(get_part=lambda _:part))
new.observe_dataset(dataset(None, '2026-11-27T06:00Z'))
assert new.status('later', a)['state'] == 'not_updating'
assert new.status('later', a)['affected_after_utc'] is None
assert new.status('later', a)['provider_arco_updated_at'] == '2026-11-27T06:00Z'
new.observe_dataset(dataset('2026-11-27T00:00Z', 'earlier'))
assert new.status('later', a)['state'] == 'updating'
source = (Path(__file__).resolve().parents[1] / 'pipeline/fetch-waves.py').read_text()
assert source.index('.load()') < source.index("'provider_status':") < source.index('temp.replace')
assert 'services_utils.get_dataset_metadata = original_metadata' in source
print('PASS 12 provider-status cases: warning capture, dataset isolation, exact boundary, HTTP/unknown cannot clear, explicit catalogue status clears, failed fetch cannot replace cache')
