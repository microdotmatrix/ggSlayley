const autoprefixer = require("autoprefixer");
const babel = require("gulp-babel");
const bs = require("browser-sync");
const cleanCSS = require("gulp-clean-css");
const dartSass = require("sass");
const del = require("del");
const { createGulpEsbuild } = require('gulp-esbuild');

const gulp = require("gulp");
const gulpSass = require("gulp-sass");
const newer = require("gulp-newer");
const notify = require("gulp-notify");
const plumber = require("gulp-plumber");

const postCss = require("gulp-postcss")
const postCssImport = require("postcss-import");
const postCssPresetEnv = require("postcss-preset-env");
const purgecss = require("gulp-purgecss");
const cssnano = require("gulp-cssnano");

const rename = require("gulp-rename");
const sourcemaps = require("gulp-sourcemaps");

// ? Configure gulp-sass
const sass = gulpSass(dartSass);

const tailwindConfig = require("./tailwind.config");

// ? Get functions from gulp
const { src, dest, parallel, series, watch } = gulp;
const pump = require('pump');

var zip = require('gulp-zip');

const mode = process.env.NODE_ENV || "production"; // Platform9 work mode
const distDir = "./assets/build"; // Build dir
const srcDir = "./assets"; // Source dir

const esbuild = createGulpEsbuild({
  incremental: true,
  piping: true
});

const paths = {
  distDir,
  srcDir,
  src: {
    scripts: `${srcDir}/scripts/app.js`,
    styles: `${srcDir}/styles/main.scss`,
  },
  dist: {
    pages: distDir,
    svg: `${distDir}/img/`,
    scripts: `${distDir}/js/`,
    styles: `${distDir}/css/`,
  },
  watch: {
    scripts: `${srcDir}/scripts/**/*.{js,mjs,mts,ts}`,
    styles: `${srcDir}/styles/**/*.{sass,scss,css}`,
    svg: `${srcDir}/images/**/*.svg`,
  },
  clean: distDir,
};

const handleError = (done) => {
    return function (err) {
        if (err) {
            beeper();
        }
        return done(err);
    };
};

function startBrowserSync (done) {
  bs.init({
    notify: false,
    open: true,
    proxy: 'localhost:2368',
    files: [
      '**/*.hbs',
      'assets/**/*.(scss|js)',
    ],
  });
  done();
};

function compileStyles () {
  // TODO: Add sourcemaps support
  const tailwindcss = require("tailwindcss");
  return src(paths.src.styles)
    .pipe(
      plumber(
        notify.onError({
          title: "Error in compileStyles task",
          message: "<%= error.message %>",
        })
      )
    )
    .pipe(sass({
      includePaths: [
        "node_modules"
      ]
    }).on("error", sass.logError))
    .pipe(dest(paths.dist.styles))
    .pipe(
      postCss([
        postCssImport,
        autoprefixer,
        tailwindcss(tailwindConfig)
      ])
    )
    .pipe(cssnano())
    .pipe(
      rename((path) => {
        path.extname = ".min.css";
      })
    )
    .pipe(plumber.stop())
    .pipe(dest(paths.dist.styles))
    .pipe(bs.stream());
};

function buildStyles() {
  return src(paths.dist.styles+'main.css')
    .pipe(
      plumber(
        notify.onError({
          title: "Error in buildStyles task",
          message: "<%= error.message %>",
        })
      )
    )
    .pipe(cssnano())
    .pipe(
      rename((path) => {
        path.extname = ".min.css";
      })
    )
    .pipe(plumber.stop())
    .pipe(dest(paths.dist.styles))
    .pipe(bs.stream());
}

function compileScripts () {
  return src(paths.src.scripts)
    .pipe(
      plumber(
        notify.onError({
          title: "Error in compileScripts task",
          message: "<%= error.message %>",
        })
      )
    )
    .pipe(
      babel({
        presets: [
          '@babel/preset-env'
        ],
      })
    )
    .pipe(
      esbuild({
        minify: false,
        format: "cjs",
        treeShaking: true,
        bundle: true,
        // TODO: Add sourcemaps support
      })
    )

    .pipe(
      rename((path) => {
        path.extname = ".min.js";
      })
    )
    .pipe(plumber.stop())
    .pipe(dest(paths.dist.scripts))
    .pipe(bs.stream());
};

// function js(done) {
//   pump([
//       src('assets/dist/js/app.js', {sourcemaps: true}),
//       uglify(),
//       rename('app.min.js'),
//       dest('assets/dist/js/', {sourcemaps: '.'}),
//   ], handleError(done));
// }

function zipper(done) {
    var targetDir = 'zip/';
    var themeName = require('./package.json').name;
    var filename = themeName + '.zip';

    pump([
      src([
        '**',
        '!zip', '!zip/**',
        '!assets/video', '!assets/video/**',
        '!assets/scss', '!assets/scss/**',
        '!assets/fonts', '!assets/fonts/**',
        '!assets/css', '!assets/css/**',
        '!assets/js', '!assets/js/**',
        '!assets/svg', '!assets/svg/**',
        '!assets/images', '!assets/images/**',
        '!assets/img', '!assets/img/**',
        '!node_modules', '!node_modules/**'
        ]),
      zip(filename),
      dest(targetDir)
    ], handleError(done));
}

// ? Remove `build` folder
function clear () {
  return del(paths.distDir);
};

// ? Configure watcher
function watcher () {
  watch(paths.watch.styles, compileStyles);
  watch(paths.watch.scripts, compileScripts);
//  watch(paths.watch.images, rasterImagesProcessing);
//  watch(paths.watch.svg, vectorImagesProcessing);
};

// ? Run before start development workflow
const local = series (
  startBrowserSync,
  watcher
);

// ? Run after start development workflow
const compile = series(
  clear,
  parallel(
    compileStyles,
    compileScripts
//    rasterImagesProcessing,
//    vectorImagesProcessing
  ),
);

/* -------------------------------------------------------------------------- */
/*                                Default task                                */
/* -------------------------------------------------------------------------- */
exports.default = compile;
exports.build = series(compile, buildStyles);
exports.watch = series(local, compile);

exports.zip = zipper;
// exports.jsmin = js;
