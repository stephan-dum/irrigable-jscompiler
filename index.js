const vm = require("vm");
const Module = require("module");
const { Transform } = require("stream");
const path = require("path");
//TODO: use config for this
let isNodeModule = /@|node_modules/i;

function mergeDeps(children, deps = []) {
  children.forEach((child) => {
    if(!isNodeModule.test(child.filename)) {
      deps.push(child.filename);

      mergeDeps(
        child.children.filter(
          (child) => deps.indexOf(child.filename) < 0
        ),
        deps
      );
    }
  });

  return deps;
}

class JSCompiler extends Transform {
  constructor(options, parent) {
    super({
      objectMode : true
    });

    if(!parent) {
      options = {};
    }


    this.cwd = options.cwd;
  }
  _transform(vinyl, encoding, callback) {
    let { path : file, dirname, contents } = vinyl;

    if(this.cwd) {
      file = path.resolve(path.join(this.cwd, vinyl.relative));
      dirname = path.dirname(file);
    }

    let str = contents.toString();

    let childModule = Object.assign(
      new Module(file, module),
      {
        filename : file,
        loaded : true,
        paths : Module._nodeModulePaths(dirname)
      }
    );

    try {
      childModule._compile(contents.toString(), file);
    } catch(error) {
      return callback(error);
    }

    vinyl.dependencies.push(
      ...mergeDeps(childModule.children)
    )

    vinyl.exports = childModule.exports;

    callback(null, vinyl);
  }
}

module.exports = JSCompiler;
