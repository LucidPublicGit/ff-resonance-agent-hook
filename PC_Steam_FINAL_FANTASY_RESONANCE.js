// ==UserScript==
// @name         FINAL FANTASY RESONANCE (experimental)
// @version      0.4.0
// @description  Steam PC; Japanese dialogue and event captions. Local custom hook.
// ==/UserScript==
'use strict';

const UE = require('./libUnrealEngine_FFRS.js');
const sendLine = trans.send(s => s, '250+');
const watched = new Map();
const localizedGetters = new Map();
const tutorialPattern = /WBP_Tutorial\.WidgetTree\.Text_(?:Title|Description)$/;
let lastOutput = '';
const textPattern = /WBP_(?:TalkWindow|TalkEvent_Caption\w*|TalkBattle_Caption\w*)_C\.WidgetTree\.m_pTextBlock$/;

function readText(object) {
    const data = object.add(0x188).readPointer();
    for (const offset of [0x18, 0x20]) {
        try {
            const length = data.add(offset + 8).readU32();
            const capacity = data.add(offset + 12).readU32();
            if (length < 2 || length > 4096 || capacity < length || capacity > 16384) continue;
            const text = data.add(offset).readPointer().readUtf16String(length - 1);
            if (text && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ue000-\uf8ff]/.test(text)) {
                return text.replace(/<[^>]*>/g, '').replace(/\r/g, '').trim();
            }
        } catch (_) {}
    }

    // String-table text uses a different FText history from ordinary dialogue.
    try {
        const vtable = data.readPointer();
        let getter = localizedGetters.get(vtable.toString());
        if (!getter) {
            // Validate the observed StringTableEntry history type before invoking
            // its display-string getter. Refuse other, unverified FText types.
            const typeMethod = vtable.add(11 * Process.pointerSize).readPointer();
            const typeInstruction = Instruction.parse(typeMethod);
            if (typeInstruction.mnemonic !== 'mov' || typeInstruction.opStr !== 'al, 0xb'
                || Instruction.parse(typeInstruction.next).mnemonic !== 'ret') return '';
            getter = new NativeFunction(vtable.add(5 * Process.pointerSize).readPointer(),
                'pointer', ['pointer']);
            localizedGetters.set(vtable.toString(), getter);
        }
        const string = getter(data);
        const length = string.add(8).readU32();
        const capacity = string.add(12).readU32();
        if (length > 1 && length <= 8192 && capacity >= length && capacity <= 32768) {
            return string.readPointer().readUtf16String(length - 1)
                .replace(/<[^>]*>/g, '').replace(/\r/g, '').trim();
        }
    } catch (_) {}
    return '';
}

function remember(object) {
    const key = object.toString();
    const existing = watched.get(key);
    if (existing && UE.getObjectId(object) === existing.id) return existing;
    if (existing) watched.delete(key);
    const context = UE.getObjectFullName(object);
    if (!textPattern.test(context) && !tutorialPattern.test(context)) return null;
    const entry = { object, context, id: UE.getObjectId(object), text: readText(object) };
    watched.set(key, entry);
    return entry;
}

function output(text) {
    if (!text || text === lastOutput) return;
    lastOutput = text;
    sendLine(text);
}

function update(entry) {
    try {
        if (UE.getObjectId(entry.object) !== entry.id) {
            watched.delete(entry.object.toString());
            return;
        }
        const text = readText(entry.object);
        if (text !== entry.text) {
            entry.text = text;
            output(text);
        }
    } catch (_) {
        watched.delete(entry.object.toString());
    }
}

// Seed existing widgets without sending retained lines from earlier scenes.
UE.ffrsForEachTextWidget((object, activeCaption = false) => {
    try {
        const entry = remember(object);
        if (entry && (activeCaption || /WBP_TalkWindow_C/.test(entry.context) || tutorialPattern.test(entry.context))) output(entry.text);
    } catch (_) {}
});

const wrapper = UE.findFunction('/Script/mucha.CPP_GradualTextBlock:BeginText');
if (!wrapper) throw new Error('Resonance BeginText function was not found; game version may differ.');
let nativeBegin = null;
let instructionAddress = wrapper;
for (let i = 0; i < 16; i++) {
    const instruction = Instruction.parse(instructionAddress);
    if (instruction.mnemonic === 'jmp' && instruction.operands[0].type === 'imm') {
        nativeBegin = ptr(instruction.opStr);
        break;
    }
    if (instruction.mnemonic === 'ret') break;
    instructionAddress = instruction.next;
}
if (!nativeBegin) throw new Error('Unsupported Resonance BeginText wrapper; refusing to guess an address.');
Interceptor.attach(nativeBegin, {
    onEnter(args) { this.object = args[0]; },
    onLeave() {
        try {
            const entry = remember(this.object);
            if (entry) {
                entry.text = readText(entry.object);
                output(entry.text);
            }
        } catch (_) {}
    }
});
// Dialogue widgets can be replaced without passing through BeginText.
// Rescan periodically; skip existing identities so retained text is not resent.
function discoverNewWidgets() {
    UE.ffrsForEachTextWidget(object => {
        try {
            const existing = watched.get(object.toString());
            if (existing && UE.getObjectId(object) === existing.id) return;
            const entry = remember(object);
            if (entry) output(entry.text);
        } catch (_) {}
    });
}
setInterval(discoverNewWidgets, 1500);
// Also catch direct native text updates that bypass Blueprint BeginText.
setInterval(() => {
    // Some centered-caption widgets are absent from the initial object scan.
    // Resolve the active window through its manager on every polling tick.
    UE.ffrsForEachActiveCaption(object => {
        try {
            const previous = watched.get(object.toString());
            const entry = remember(object);
            if (entry && entry !== previous) output(entry.text);
        } catch (_) {}
    });
    for (const entry of watched.values()) update(entry);
}, 200);
console.log('Resonance hook ready: ' + watched.size + ' dialogue/caption/tutorial widgets. Speaker names and menus excluded.');
