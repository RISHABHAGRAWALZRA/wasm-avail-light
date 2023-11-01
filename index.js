import { createApi } from "./api.js";
import init, { check } from "./pkg/wasm_avail_light.js";

const CHUNK_SIZE = 32;
const DATA_CHUNK_SIZE = 31;
const PADDING_TAIL_VALUE = 0x80;
const COMMITMENT_SIZE = 48;
const KATE_PROOF_SIZE = 80;
const EXTENSION_FACTOR = 2;
const SAMPLE_SIZE = 5

await init()
let runBtn = document.getElementById("run")
runBtn.addEventListener('click', checkForVerification)

let blockNumber = document.getElementById("blockNumber")
let blockHash = document.getElementById("blockHash")
let maxRow = document.getElementById("maxRow")
let maxCol = document.getElementById("maxCol")
let totalCount = document.getElementById("totalCount")
let sampleCount = document.getElementById("sampleCount")
let conf = document.getElementById("conf")
let verify = document.getElementById("verify")


async function checkForVerification() {

    const api = await createApi();

    const unsubscribe = await api.rpc.chain.subscribeFinalizedHeads(async (header) => {

        const blockNumber = header.number
        const extension = JSON.parse(header.extension)
        const commitment = extension.v1.commitment
        const kateCommitment = commitment.commitment.split('0x')[1]
        const r = commitment.rows
        const c = commitment.cols

        console.log(`Chain is at block: #${header.extension}`);
        //fetching block hash from number 
        const blockHash = await api.rpc.chain.getBlockHash(header.number);
        console.log(`check run + ${blockHash}`)

        //Detaiils updated on UI
        updateDetails(blockNumber, blockHash, r, c, (r * 2) * c, SAMPLE_SIZE, null, false)

        //Query data proof for sample 0,0
        const cells = generateRandomCells(r, c, SAMPLE_SIZE)
        console.log(cells)
        const kateProof = await api.rpc.kate.queryProof(cells, blockHash.toString());




        const kate_Proof = Uint8Array.from(kateProof)
        const kate_commitment = Uint8Array.from(kateCommitment.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
        let commitments = []
        for (let i = 0; i < (r * EXTENSION_FACTOR); i++) {
            commitments.push(kate_commitment.slice(i * COMMITMENT_SIZE, (i + 1) * COMMITMENT_SIZE))
        }
        let proofs = []
        for (let i = 0; i < SAMPLE_SIZE; i++) {
            proofs.push(kate_Proof.slice(i * KATE_PROOF_SIZE, (i + 1) * KATE_PROOF_SIZE))
        }
        //console.log(proofs, commitments)
        let verfiedCount = 0
        cells.forEach((cell, i) => {
            if (check(proofs[i], commitments[cell.row], c, cell.row, cell.col)) { verfiedCount++ }
        })
        const confidence = 100 * (1 - (1 / (Math.pow(2, verfiedCount))))
        if (verfiedCount) updateDetails(null, null, null, null, null, null, confidence, true)
    });
}

const updateDetails = (number, hash, r, c, tCount, sCount, confPercent, res) => {
    if (number != null) blockNumber.innerText = number
    if (hash != null) blockHash.innerText = hash
    if (r != null) maxRow.innerText = r
    if (c != null) maxCol.innerText = c
    if (tCount != null) totalCount.innerHTML = tCount
    if (sCount != null) sampleCount.innerHTML = sCount
    if (confPercent != null) conf.innerHTML = confPercent
    if (res != null) verify.innerHTML = res
}


const generateRandomCells = (r, c, count) => {
    const extendedRowCount = r * 2
    const maxCellCount = extendedRowCount * c;
    let size = count;
    if (maxCellCount < count) {
        size = maxCellCount
    }
    let cellList = []
    let randomPointList = randomUniqueNum(maxCellCount, size)
    //console.log(randomPointList)
    randomPointList.forEach((p) => {
        const row = Math.floor(p / c)
        const col = p - row * c
        cellList.push({ row, col })
    })
    return cellList
}


function randomUniqueNum(range, outputCount) {

    let arr = []
    for (let i = 0; i < range; i++) {
        arr.push(i)
    }

    let result = [];

    for (let i = 1; i <= outputCount; i++) {
        const random = Math.floor(Math.random() * (range - i));
        result.push(arr[random]);
        arr[random] = arr[range - i];
    }

    return result;
}

