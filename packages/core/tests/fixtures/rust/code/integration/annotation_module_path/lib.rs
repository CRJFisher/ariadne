mod a;
mod b;
mod c;

fn run_relative(state: &a::State) {
    state.go();
}

fn run_anchored(state: &mut crate::a::State) {
    state.go();
}
