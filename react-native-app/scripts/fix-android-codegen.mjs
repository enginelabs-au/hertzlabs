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
const JAVA_DIR = path.join(ROOT, 'android/app/build/generated/source/codegen/java');
const CMAKE = path.join(JNI_DIR, 'CMakeLists.txt');
const APP_SPEC = 'HertzLabsBinauralBeatsSpec';

const FIXED_CMAKE = `# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# Patched by fix-android-codegen.mjs — app-local Hertz specs only (third-party via AAR).

cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS ${APP_SPEC}-generated.cpp react/renderer/components/${APP_SPEC}/*.cpp)

add_library(
  react_codegen_${APP_SPEC}
  OBJECT
  \${react_codegen_SRCS}
)

target_include_directories(react_codegen_${APP_SPEC} PUBLIC . react/renderer/components/${APP_SPEC})

target_link_libraries(
  react_codegen_${APP_SPEC}
  fbjni
  jsi
  reactnative
)

target_compile_reactnative_options(react_codegen_${APP_SPEC} PRIVATE)
`;

function patchCMakeLists() {
  if (!fs.existsSync(CMAKE)) {
    console.warn(`fix-android-codegen: ${CMAKE} not found — run Gradle codegen first`);
    return;
  }
  const cmake = fs.readFileSync(CMAKE, 'utf8');
  const expectedGlob = `file(GLOB react_codegen_SRCS CONFIGURE_DEPENDS ${APP_SPEC}-generated.cpp react/renderer/components/${APP_SPEC}/*.cpp)`;
  if (cmake.includes(expectedGlob) && cmake.includes(`react_codegen_${APP_SPEC}`)) {
    console.log('fix-android-codegen: CMakeLists already patched');
    return;
  }
  fs.writeFileSync(CMAKE, FIXED_CMAKE);
  console.log('fix-android-codegen: rewrote CMakeLists for app-local codegen only');
}

/** Third-party codegen Java is linked via each library's AAR — keep app-local Hertz specs only. */
const JAVA_KEEP = /^NativeHertz|NativeHertz|^com\/hertzlabs\//;

function removeThirdPartyJavaCodegen() {
  if (!fs.existsSync(JAVA_DIR)) {
    return;
  }
  const stack = [JAVA_DIR];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        stack.push(full);
        continue;
      }
      const rel = path.relative(JAVA_DIR, full).replace(/\\/g, '/');
      if (JAVA_KEEP.test(rel)) {
        continue;
      }
      fs.unlinkSync(full);
      console.log(`fix-android-codegen: removed java/${rel}`);
    }
  }
}

function main() {
  patchCMakeLists();
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

  removeThirdPartyJavaCodegen();
}

main();
