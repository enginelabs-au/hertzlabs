#!/usr/bin/env node
/**
 * Prevent duplicate TurboModule symbols on Android.
 *
 * Gradle codegen drops every library's *-generated.cpp into
 * android/app/build/generated/source/codegen/jni/, but CMakeLists.txt
 * globs *.cpp — so appmodules links the same providers twice (app + autolink).
 *
 * Run after codegen / before native Android builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JNI_DIR = path.join(ROOT, 'android/app/build/generated/source/codegen/jni');
const CMAKE = path.join(JNI_DIR, 'CMakeLists.txt');
const APP_SPEC = 'HertzLabsBinauralBeatsSpec';

const WRONG_GLOB =
  'file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS *.cpp react/renderer/components/HertzLabsBinauralBeatsSpec/*.cpp)';
const FIXED_GLOB = `file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS ${APP_SPEC}-generated.cpp react/renderer/components/${APP_SPEC}/*.cpp)`;

function main() {
  if (!fs.existsSync(CMAKE)) {
    console.warn(`fix-android-codegen: ${CMAKE} not found — run Gradle codegen first`);
    process.exit(0);
  }

  let cmake = fs.readFileSync(CMAKE, 'utf8');
  if (cmake.includes(FIXED_GLOB)) {
    console.log('fix-android-codegen: CMakeLists already patched');
  } else if (cmake.includes(WRONG_GLOB)) {
    cmake = cmake.replace(WRONG_GLOB, FIXED_GLOB);
    fs.writeFileSync(CMAKE, cmake);
    console.log('fix-android-codegen: patched CMakeLists to exclude third-party *-generated.cpp');
  } else {
    console.warn('fix-android-codegen: unexpected CMakeLists format — manual review needed');
  }

  if (fs.existsSync(JNI_DIR)) {
    for (const name of fs.readdirSync(JNI_DIR)) {
      if (name.endsWith('-generated.cpp') && name !== `${APP_SPEC}-generated.cpp`) {
        fs.unlinkSync(path.join(JNI_DIR, name));
        console.log(`fix-android-codegen: removed ${name}`);
      }
    }
    const componentsDir = path.join(JNI_DIR, 'react/renderer/components');
    if (fs.existsSync(componentsDir)) {
      for (const name of fs.readdirSync(componentsDir)) {
        if (name !== APP_SPEC) {
          fs.rmSync(path.join(componentsDir, name), {recursive: true, force: true});
          console.log(`fix-android-codegen: removed components/${name}`);
        }
      }
    }
  }
}

main();
