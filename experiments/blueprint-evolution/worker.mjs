import {parentPort,workerData} from 'node:worker_threads';
import {evolve} from './wfc.mjs';
parentPort.postMessage(evolve(workerData.model,workerData.config));
