/** renderer */
function createRenderer(rendererOptions) {
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

/** createAppApi */
function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const app = {};
    return app;
  };
}
