# ASV benchmark suppression evidence (mirrors pandas asv_bench/benchmarks/
# frame_ctor.py): the ASV runner discovers `time_*` methods by introspection and
# invokes them, so they have no source-level call site but are not dead code.


class FromScalar:
    def time_frame_from_scalar_ea_float64(self):
        pass

    def time_frame_from_scalar_ea_float64_na(self):
        pass

    def time_nested_dict(self):
        pass
