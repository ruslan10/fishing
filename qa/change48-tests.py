import importlib.util,unittest
from pathlib import Path
from datetime import datetime,timedelta,timezone
S=importlib.util.spec_from_file_location('s',Path(__file__).resolve().parents[1]/'pipeline/change-statistics.py');s=importlib.util.module_from_spec(S);S.loader.exec_module(s)
class Tests(unittest.TestCase):
 def setUp(self):
  self.end='2026-11-19T00:00:00+02:00';self.h={'time':[(s.utc(self.end)-timedelta(hours=900-i)).isoformat() for i in range(900)],'v':[0.]*900}
 def test_constant(self):self.assertFalse(s.evaluate(self.h,'v',self.end)['unusual_relative_to_month'])
 def test_spike(self):
  self.h['v'][-1]=10;self.assertEqual(s.stat(self.h,'v',self.end)['signed_change_24h'],10);self.assertTrue(s.evaluate(self.h,'v',self.end)['unusual_relative_to_month'])
 def test_future(self):
  old=s.stat(self.h,'v',self.end);self.h['time'].append(self.end);self.h['v'].append(999);self.assertEqual(old,s.stat(self.h,'v',self.end))
 def test_missing(self):self.h['v'][-1]=None;self.assertFalse(s.stat(self.h,'v',self.end)['available'])
 def test_reference_missing(self):self.h['v'][:850]=[None]*850;self.assertIsNone(s.evaluate(self.h,'v',self.end)['unusual_relative_to_month'])
 def test_dst(self):
  end='2026-10-26T00:00:00+02:00';h={'time':[(s.utc(end)-timedelta(hours=48-i)).isoformat() for i in range(48)],'v':list(range(48))};r=s.stat(h,'v',end);self.assertEqual(r['valid'],48);self.assertEqual(r['signed_change_24h'],24)
unittest.main()
