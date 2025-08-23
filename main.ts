





namespace algobit {

    export enum LinePolarity {
        //% block="ligne = LOW (0)"
        Low = 0,
        //% block="ligne = HIGH (1)"
        High = 1
    }

    export class Pinout {
        motorR1: AnalogPin; motorR2: AnalogPin;
        motorL1: AnalogPin; motorL2: AnalogPin;
        trig: DigitalPin; echo: DigitalPin;
        irLeft: AnalogPin; irMiddle: AnalogPin; irRight: AnalogPin;
        buzzer: AnalogPin;
        btTx: DigitalPin; btRx: DigitalPin;

        constructor() {
            this.motorR1 = AnalogPin.P8;  this.motorR2 = AnalogPin.P12;
            this.motorL1 = AnalogPin.P16; this.motorL2 = AnalogPin.P9;
            this.trig = DigitalPin.P8; this.echo = DigitalPin.P12;
            this.irLeft = AnalogPin.P0; this.irMiddle = AnalogPin.P1; this.irRight = AnalogPin.P2;
            this.buzzer = AnalogPin.P9;
            this.btTx = DigitalPin.P8; this.btRx = DigitalPin.P12;
        }
    }

    let pinout = new Pinout();
    function clip100(v: number) { return Math.max(-100, Math.min(100, v|0)); }
    function pwm(v: number) { return Math.max(0, Math.min(1023, v|0)); }
    function asDig(p: AnalogPin): DigitalPin { return <DigitalPin><number>p; }

    //% block="configurer | Moteur R1 %r1 R2 %r2 L1 %l1 L2 %l2 | IR G %irl M %irm D %irr | TRIG %trig ECHO %echo | Buzzer %buzz | BT TX %tx RX %rx"
    //% group="Configuration" weight=100
    export function setup(
        r1: AnalogPin = AnalogPin.P8,  r2: AnalogPin = AnalogPin.P12,
        l1: AnalogPin = AnalogPin.P16, l2: AnalogPin = AnalogPin.P9,
        irl: AnalogPin = AnalogPin.P0, irm: AnalogPin = AnalogPin.P1, irr: AnalogPin = AnalogPin.P2,
        trig: DigitalPin = DigitalPin.P8, echo: DigitalPin = DigitalPin.P12,
        buzz: AnalogPin = AnalogPin.P9,
        tx: DigitalPin = DigitalPin.P8, rx: DigitalPin = DigitalPin.P12
    ): void {
        pinout.motorR1 = r1; pinout.motorR2 = r2; pinout.motorL1 = l1; pinout.motorL2 = l2;
        pinout.irLeft = irl; pinout.irMiddle = irm; pinout.irRight = irr;
        pinout.trig = trig; pinout.echo = echo;
        pinout.buzzer = buzz;
        pinout.btTx = tx; pinout.btRx = rx;
        serial.redirect(tx, rx, BaudRate.BaudRate9600);
    }

    // Motors
    function writeMotors(r1: number, r2: number, l1: number, l2: number) {
        pins.analogWritePin(pinout.motorR1, pwm(r1));
        pins.analogWritePin(pinout.motorR2, pwm(r2));
        pins.analogWritePin(pinout.motorL1, pwm(l1));
        pins.analogWritePin(pinout.motorL2, pwm(l2));
    }
    //% block="avancer à vitesse %speed" group="Moteurs" //% speed.min=0 speed.max=100
    export function forward(speed: number) { const s = clip100(speed) * 10; writeMotors(s,0,s,0); }
    //% block="reculer à vitesse %speed" group="Moteurs" //% speed.min=0 speed.max=100
    export function backward(speed: number) { const s = clip100(speed) * 10; writeMotors(0,s,0,s); }
    //% block="tourner gauche vitesse %speed" group="Moteurs" //% speed.min=0 speed.max=100
    export function turnLeft(speed: number) { const s = clip100(speed) * 10; writeMotors(0,s,s,0); }
    //% block="tourner droite vitesse %speed" group="Moteurs" //% speed.min=0 speed.max=100
    export function turnRight(speed: number) { const s = clip100(speed) * 10; writeMotors(s,0,0,s); }
    //% block="moteurs gauche %left et droite %right (%%)" group="Moteurs" //% left.min=-100 left.max=100 right.min=-100 right.max=100
    export function tank(left: number, right: number) {
        const l = clip100(left) * 10; const r = clip100(right) * 10;
        writeMotors(r>0?r:0, r<0?-r:0, l>0?l:0, l<0?-l:0);
    }
    //% block="moteurs stop" group="Moteurs"
    export function stop() { writeMotors(0,0,0,0); }

    // IR digital
    //% block="IR gauche (digital)" group="Capteurs IR"
    export function irLeftD(): number { return pins.digitalReadPin(asDig(pinout.irLeft)); }
    //% block="IR milieu (digital)" group="Capteurs IR"
    export function irMiddleD(): number { return pins.digitalReadPin(asDig(pinout.irMiddle)); }
    //% block="IR droite (digital)" group="Capteurs IR"
    export function irRightD(): number { return pins.digitalReadPin(asDig(pinout.irRight)); }

    // IR analog
    //% block="IR gauche (0–1023)" group="Capteurs IR"
    export function irLeftA(): number { return pins.analogReadPin(pinout.irLeft); }
    //% block="IR milieu (0–1023)" group="Capteurs IR"
    export function irMiddleA(): number { return pins.analogReadPin(pinout.irMiddle); }
    //% block="IR droite (0–1023)" group="Capteurs IR"
    export function irRightA(): number { return pins.analogReadPin(pinout.irRight); }

    // Line follow (digital)
    //% block="suivi digital (ligne %polarity) vitesse %speed" group="Capteurs IR" //% speed.min=0 speed.max=100
    export function lineFollowDigital(polarity: LinePolarity, speed: number) {
        const L = irLeftD()   == (polarity == LinePolarity.High ? 1 : 0);
        const C = irMiddleD() == (polarity == LinePolarity.High ? 1 : 0);
        const R = irRightD()  == (polarity == LinePolarity.High ? 1 : 0);
        if (C && !L && !R) forward(speed);
        else if (L && !R) turnLeft(speed);
        else if (R && !L) turnRight(speed);
        else if (!L && !C && !R) stop();
        else forward(Math.max(10, speed/2));
    }

    // Line follow (analog threshold)
    //% block="suivi analogique: seuil %threshold vitesse %speed (ligne=LOW)" group="Capteurs IR" //% threshold.min=0 threshold.max=1023 speed.min=0 speed.max=100
    export function lineFollowThreshold(threshold: number, speed: number) {
        const L = irLeftA()   < threshold;
        const C = irMiddleA() < threshold;
        const R = irRightA()  < threshold;
        if (C && !L && !R) forward(speed);
        else if (L && !R) turnLeft(speed);
        else if (R && !L) turnRight(speed);
        else if (!L && !C && !R) stop();
        else forward(Math.max(10, speed/2));
    }

    // Ultrasonic
    //% block="distance ultrason (cm) trig %t echo %e" group="Ultrason"
    export function distanceCm(t: DigitalPin = DigitalPin.P8, e: DigitalPin = DigitalPin.P12): number {
        pins.setPull(e, PinPullMode.PullNone);
        pins.digitalWritePin(t, 0); control.waitMicros(2);
        pins.digitalWritePin(t, 1); control.waitMicros(10);
        pins.digitalWritePin(t, 0);
        const d = pins.pulseIn(e, PulseValue.High, 23000);
        return Math.idiv(d, 58);
    }

    // Buzzer (P9)
    //% block="bip fréquence %freq Hz durée %ms ms" group="Son" //% freq.min=100 freq.max=5000 ms.min=10 ms.max=2000
    export function beep(freq: number, ms: number) {
        pins.analogSetPitchPin(pinout.buzzer);
        music.playTone(freq|0, ms|0);
    }
    //% block="mélodie %mel (tempo bpm %bpm)" group="Son" //% bpm.min=60 bpm.max=240
    export function melody(mel: string, bpm: number = 120) {
        pins.analogSetPitchPin(pinout.buzzer);
        music.setTempo(bpm|0);
        music.beginMelody(mel.split(" "), MelodyOptions.Once);
    }

    // Bluetooth UART
    //% block="BT config UART TX %tx RX %rx à %baud" group="Bluetooth"
    export function btConfig(tx: DigitalPin, rx: DigitalPin, baud: BaudRate) { serial.redirect(tx, rx, baud); }
    //% block="BT envoyer ligne %s" group="Bluetooth"
    export function btSendLine(s: string) { serial.writeLine(s); }
    //% block="BT lire ligne" group="Bluetooth"
    export function btReadLine(): string { return serial.readLine(); }

    // Logo util
    //% block="afficher logo AissaouiSchools (ms %ms)" group="Utilitaires" //% ms.min=100 ms.max=4000
    export function showLogo(ms: number = 800) {
        basic.showLeds(`
            . # # # .
            # . . . #
            # # # # #
            # . . . #
            # . . . #
        `);
        basic.pause(ms|0);
        basic.clearScreen();
    }
}
