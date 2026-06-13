#!/usr/bin/env node
import {execSync} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

const py = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generate_iap_promo_images.py');
execSync(`python3 "${py}"`, {stdio: 'inherit'});
