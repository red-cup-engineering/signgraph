import {
  knowledgeMeetReading, readingOfSides, samePoint, truthMeetAll,
  truthTop, truthBottom, knowledgeTop, knowledgeBottom, readingAs,
} from "@red-cup-engineering/metrologic/four";
import { admitCell, told } from "@red-cup-engineering/signcell";
import { readSourceArray, readSourceRecord } from "@red-cup-engineering/semiotic-content-address-system";

const witnessedReading = source => readingOfSides("knowledge", ...told(admitCell(source)));

function readDimension(source) {
  const { declaration, obligations } = readSourceRecord(source);
  const cells = readSourceArray(obligations).map(source => admitCell(source));
  const readings = cells.map(witnessedReading);
  const declared = declaration === undefined ? knowledgeBottom() : witnessedReading(declaration);
  const derived = truthMeetAll(readings, "knowledge");
  const contested = Object.freeze(cells.filter((_cell, index) => samePoint(readings[index], knowledgeTop())));
  return Object.freeze({ declared, derived, agrees: samePoint(declared, derived), contested });
}

/** Read declarations and the witnessed obligations separately. Logical
 * conjunction within a dimension is monotone in knowledge. The knowledge
 * meet across dimensions and the operational readiness decision are explicit. */
export function readWorkSettlement(source) {
  const { meaning, execution } = readSourceRecord(source);
  const left = readDimension(meaning), right = readDimension(execution);
  return Object.freeze({
    meaning: left, execution: right,
    agrees: left.agrees && right.agrees,
    knowledgeMeet: knowledgeMeetReading(left.derived, right.derived),
    ready: [left, right].every(result => samePoint(result.derived, truthTop()) && result.contested.length === 0),
  });
}

const blockersFirst = [truthBottom(), knowledgeTop(), knowledgeBottom(), truthTop()];

/** Fold per-capability FOUR readings for dispatch. This is the policy order
 * for independent requirements: refusal, contest, unknown, fit. */
export function dispatchFit(requirements) {
  const reported = new Set(readSourceArray(requirements).map(reading => readingAs("knowledge", reading)));
  return blockersFirst.find(reading => reported.has(reading)) ?? truthTop();
}
