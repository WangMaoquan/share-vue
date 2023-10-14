export function createRenderer(rendererOptions) {
  const {} = rendererOptions;
  // todo others methods
  function render() {
    // todo
  }
  return {
    render,
    createApp: createAppApi(render),
  };
}
