"""Capture catalogue metadata used by the normal wave request. No extra requests."""
import logging
import re

DATASET = 'cmems_mod_med_wav_anfc_4.2km_PT1H-i'
SOURCE_URL = 'https://data.marine.copernicus.eu/product/MEDSEA_ANALYSISFORECAST_WAV_006_017/description'
PATTERN = re.compile(r'Data after ([0-9T:.+Z-]+) may not be up to date')

def warning_boundary(message):
    if DATASET not in message or 'currently being updated' not in message:
        return None
    match = PATTERN.search(message)
    return match.group(1) if match else None

class WaveStatusCapture(logging.Handler):
    def __init__(self):
        super().__init__()
        self.boundary = None
        self.observed = False
        self.updated_at = None

    def observe_dataset(self, dataset):
        if dataset is None or dataset.dataset_id != DATASET:
            return
        part = dataset.get_version(None).get_part(None)
        self.boundary = part.arco_updating_start_date
        self.updated_at = part.arco_updated_date
        self.observed = True

    def emit(self, record):
        boundary = warning_boundary(record.getMessage())
        if boundary:
            self.boundary = boundary

    def status(self, checked_at, previous=None):
        if not self.observed and not self.boundary and previous:
            return previous
        return {
            'state': 'updating' if self.boundary else ('not_updating' if self.observed else 'unknown'),
            'checked_at': checked_at,
            'affected_after_utc': self.boundary,
            'provider_arco_updated_at': self.updated_at,
            'source_url': SOURCE_URL,
            'evidence': 'provider catalogue metadata used by normal open_dataset' if self.observed else 'provider warning captured from normal open_dataset',
            'meaning': 'Provider update status, not proof of wrong values or a new model run; retrieval time is not model initialization time.',
        }
