import fs from "fs"
import parser from "@babel/parser"
import path from "path"
import traverse from "@babel/traverse"
import ejs from "ejs"
import { transformFromAst } from "babel-core"
import { jsonLoader } from './jsonLoader.js'

const webpackConfig = {
  module: {
    rules: [
      {
        test: /\.json$/,
        use: [jsonLoader]
      },
    ],
  },
}

let id = 0

function createAsset(filePath) {
  let source = fs.readFileSync(filePath, {
    encoding: "utf-8",
  })
  const loaders = webpackConfig.module.rules
  loaders.forEach(({ test, use}) => {
    if(test.test(filePath)) {
      if(Array.isArray(use)) {
        use.reverse().forEach((fn) => {
          source = fn(source)
        })
      } else {
        source = use(source)
      }
    }
  })
  const ast = parser.parse(source, {
    sourceType: "module",
  })
  const deps = []
  traverse.default(ast, {
    ImportDeclaration({ node }) {
      deps.push(node.source.value)
    },
  })

  const { code } = transformFromAst(ast, null, {
    presets: ["env"],
  })
  console.log(code)
  return {
    filePath,
    code,
    deps,
    mapping: {},
    id: id++,
  }
}

// const asset = createAsset()
// console.log(asset)
function createGraph() {
  const mainAsset = createAsset("./example/main.js")
  const queue = [mainAsset]
  for (const asset of queue) {
    asset.deps.forEach((relativePath) => {
      const child = createAsset(path.resolve("./example", `${relativePath}`))
      asset.mapping[relativePath] = child.id
      // console.log(child)
      queue.push(child)
    })
  }
  return queue
}

const graph = createGraph()
console.log(graph)

function build(graph) {
  const template = fs.readFileSync("./bundle.ejs", { encoding: "utf-8" })

  const data = graph.map((asset) => {
    const { id, code, mapping } = asset
    return { id, code, mapping }
  })
  // console.log(data)
  const code = ejs.render(template, {
    data,
  })
  fs.writeFileSync("./dist/bundle.js", code)
  // console.log(code)
}

build(graph)
