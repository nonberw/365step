import type { Preset } from "./circuit";
import type { SimCondition } from "./sim/checks";

// Arduino lessons for Нурбек Чурбек on top of Athena IDE's breadboard simulator: each lesson opens a ready circuit
// (an Athena preset), gives an unfinished sketch and checks the student's code on the virtual board with the
// simulator's own automatic tests. Proven by scripts/arduino-check.ts: the generated reference sketch passes,
// the starter does not.

export interface ArduinoLesson {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  preset: Preset;
  theory: string;
  task: string;
  starter: string;
  check: SimCondition;
  xp: number;
}

export const ARDUINO_LESSONS: ArduinoLesson[] = [
  {
    id: "blink",
    title: "Мигающий светодиод",
    level: 1,
    preset: "led",
    theory:
      "Программа Arduino состоит из двух функций: setup() выполняется один раз при включении, loop() — по кругу, пока есть питание. digitalWrite(pin, HIGH) подаёт на вывод 5 В, LOW — 0 В, delay(мс) ждёт. Резистор 220 Ом ограничивает ток через светодиод, иначе он сгорит.",
    task: "Сделай так, чтобы светодиод мигал с периодом 1 секунда: 0.5 с горит, 0.5 с не горит.",
    starter: `const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  // TODO: подожди, выключи светодиод и снова подожди
}
`,
    check: { kind: "blink", periodMs: 1000 },
    xp: 40,
  },
  {
    id: "serial",
    title: "Монитор порта",
    level: 1,
    preset: "led",
    theory:
      'Serial — это связь платы с компьютером по USB. Serial.begin(9600) включает её на скорости 9600 бит/с, Serial.println("текст") печатает строку в монитор порта. Так инженеры смотрят, что происходит внутри программы.',
    task: "Выведи в монитор порта строку Hello, BSTS!",
    starter: `void setup() {
  // TODO: включи Serial и напечатай Hello, BSTS!
}

void loop() {
}
`,
    check: { kind: "serial", text: "Hello, BSTS!" },
    xp: 30,
  },
  {
    id: "button",
    title: "Кнопка и светодиод",
    level: 1,
    preset: "button",
    theory:
      "Кнопка подключена между выводом 2 и землёй. Режим INPUT_PULLUP включает внутренний резистор к 5 В, поэтому отпущенная кнопка читается как HIGH, а нажатая — как LOW. Без подтяжки вход «висит в воздухе» и читает случайные значения.",
    task: "Светодиод должен гореть ровно тогда, когда кнопка нажата. Нажимай кнопку на схеме мышкой.",
    starter: `const int LED = 13;
const int BTN = 2;

void setup() {
  pinMode(LED, OUTPUT);
  pinMode(BTN, INPUT_PULLUP);
}

void loop() {
  int pressed = digitalRead(BTN) == LOW;
  // TODO: включи светодиод, если кнопка нажата, и выключи, если нет
}
`,
    check: { kind: "button-output" },
    xp: 40,
  },
  {
    id: "traffic",
    title: "Светофор",
    level: 1,
    preset: "traffic",
    theory: "Три светодиода на выводах 11, 12 и 13. Удобно написать свою функцию light(pin, ms): включить, подождать, выключить — и вызывать её для каждого цвета. Функции делают код короче и понятнее.",
    task: "Светофор должен по кругу показывать зелёный, потом жёлтый, потом красный.",
    starter: `const int RED_LED = 13;
const int YELLOW_LED = 12;
const int GREEN_LED = 11;

void setup() {
  pinMode(RED_LED, OUTPUT); pinMode(YELLOW_LED, OUTPUT); pinMode(GREEN_LED, OUTPUT);
}

void light(int pin, int ms) {
  digitalWrite(pin, HIGH); delay(ms); digitalWrite(pin, LOW);
}

void loop() {
  light(GREEN_LED, 4000);
  // TODO: жёлтый и красный
}
`,
    check: { kind: "sequence" },
    xp: 50,
  },
  {
    id: "dimmer",
    title: "Регулятор яркости",
    level: 2,
    preset: "dimmer",
    theory:
      "Потенциометр — делитель напряжения: analogRead(A0) возвращает число от 0 до 1023. Светодиод на выводе с ШИМ (PWM) можно сделать тусклее: analogWrite(pin, 0..255) быстро включает и выключает его, меняя долю времени. map(v, 0, 1023, 0, 255) пересчитывает один диапазон в другой.",
    task: "Ручка потенциометра должна плавно менять яркость светодиода. Крути ручку на схеме.",
    starter: `const int POT = A0;
const int LED = 5;   // вывод с ШИМ

void setup() { pinMode(LED, OUTPUT); }

void loop() {
  int v = analogRead(POT);   // 0..1023
  // TODO: переведи v в 0..255 и задай яркость через analogWrite
  delay(5);
}
`,
    check: { kind: "pot-brightness" },
    xp: 60,
  },
  {
    id: "servo",
    title: "Сервопривод",
    level: 2,
    preset: "servo",
    theory: "Сервопривод поворачивается на угол от 0 до 180°, который задают командой servo.write(угол). Библиотека Servo.h сама формирует управляющие импульсы. Это основа роботов-манипуляторов и рулей.",
    task: "Сервопривод должен поворачиваться вслед за ручкой потенциометра: 0 → 0°, максимум → 180°.",
    starter: `#include <Servo.h>
Servo servo;
const int POT = A0;
const int SERVO_PIN = 6;

void setup() { servo.attach(SERVO_PIN); }

void loop() {
  int v = analogRead(POT);
  // TODO: поверни сервопривод на угол от 0 до 180 по положению ручки
  delay(15);
}
`,
    check: { kind: "pot-servo" },
    xp: 60,
  },
  {
    id: "distance",
    title: "Ультразвуковая сигнализация",
    level: 2,
    preset: "distance",
    theory:
      "Датчик HC-SR04 посылает ультразвуковой импульс и ловит эхо. pulseIn(ECHO, HIGH) возвращает время полёта в микросекундах. Звук проходит 0.0343 см за микросекунду, а путь — туда и обратно, поэтому расстояние = время × 0.0343 / 2.",
    task: "Пищалка должна звучать, когда препятствие ближе 20 см, и молчать дальше. Двигай препятствие на схеме.",
    starter: `const int TRIG = 9;
const int ECHO = 10;
const int BUZZ = 8;

void setup() {
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(BUZZ, OUTPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  // TODO: посчитай расстояние в см и включи пищалку ближе 20 см
  delay(60);
}
`,
    check: { kind: "alarm-below", cm: 20 },
    xp: 70,
  },
  {
    id: "parking",
    title: "Парктроник",
    level: 3,
    preset: "parking",
    theory:
      "В машинах парктроник пищит тем чаще, чем ближе препятствие. Пауза между сигналами зависит от расстояния — снова пригодится map(). Обрати внимание: 0 см значит «эхо не вернулось», это не препятствие вплотную.",
    task: "Пищи чаще по мере приближения препятствия (до 60 см), дальше — молчи.",
    starter: `const int TRIG = 9;
const int ECHO = 10;
const int BUZZ = 8;
const int LED = 13;

void setup() {
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT); pinMode(BUZZ, OUTPUT); pinMode(LED, OUTPUT);
}

float distanceCm() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us * 0.0343 / 2;
}

void loop() {
  float cm = distanceCm();
  if (cm > 0 && cm < 60) {
    int gap = 300;   // TODO: пауза должна зависеть от расстояния
    digitalWrite(LED, HIGH); digitalWrite(BUZZ, HIGH); delay(40);
    digitalWrite(LED, LOW);  digitalWrite(BUZZ, LOW);  delay(gap);
  } else {
    delay(60);
  }
}
`,
    check: { kind: "beeps-faster" },
    xp: 90,
  },
  {
    id: "night",
    title: "Ночник",
    level: 2,
    preset: "night",
    theory:
      "Фоторезистор меняет сопротивление от света, и analogRead(A1) растёт, когда светлее. Порог (например, 307) отделяет «темно» от «светло». Печатай значения в монитор порта, чтобы подобрать порог по-инженерному — по измерениям.",
    task: "Светодиод включается в темноте и выключается при свете. Меняй освещённость на схеме.",
    starter: `const int LIGHT = A1;   // выше = светлее
const int LED = 13;
const int DARK = 307;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(LIGHT);
  Serial.println(light);
  // TODO: включи светодиод, когда темно
  delay(100);
}
`,
    check: { kind: "dark-light" },
    xp: 60,
  },
  {
    id: "thermo",
    title: "Термометр на дисплее",
    level: 3,
    preset: "thermo",
    theory:
      "Датчик TMP36 выдаёт 0.5 В при 0 °C и прибавляет 10 мВ на градус: °C = (U − 0.5) × 100. Напряжение из analogRead: U = raw × 5.0 / 1023. Дисплей 16×2 подключён по шине I2C: lcd.setCursor(столбец, строка), lcd.print(...).",
    task: "Покажи на дисплее температуру в градусах Цельсия.",
    starter: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
const int TEMP = A2;

void setup() {
  lcd.init();
  lcd.backlight();
}

void loop() {
  int raw = analogRead(TEMP);
  // TODO: переведи raw в вольты, вольты в градусы и выведи на дисплей
  delay(500);
}
`,
    check: { kind: "display-temperature" },
    xp: 90,
  },
  {
    id: "robot",
    title: "Робот объезжает препятствия",
    level: 3,
    preset: "obstacle",
    theory:
      "Два мотора через драйвер: скорость задаёт ШИМ, направление — второй вывод. Чтобы развернуться на месте, одно колесо крутится вперёд, другое назад. Это та же логика, что у робота-пылесоса: датчик → решение → моторы.",
    task: "Робот едет вперёд, а если впереди препятствие ближе 20 см — поворачивает.",
    starter: `const int TRIG = 9;
const int ECHO = 10;
const int L_IA = 3, L_IB = 4;
const int R_IA = 11, R_IB = 12;

void motor(int ia, int ib, int speed) {
  if (speed >= 0) { analogWrite(ia, speed); digitalWrite(ib, LOW); }
  else { analogWrite(ia, 255 + speed); digitalWrite(ib, HIGH); }
}
void drive(int left, int right) { motor(L_IA, L_IB, left); motor(R_IA, R_IB, right); }

float distanceCm() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us * 0.0343 / 2;
}

void setup() {
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  pinMode(L_IA, OUTPUT); pinMode(L_IB, OUTPUT); pinMode(R_IA, OUTPUT); pinMode(R_IB, OUTPUT);
}

void loop() {
  float cm = distanceCm();
  drive(200, 200);   // TODO: если препятствие ближе 20 см — развернись
  delay(40);
}
`,
    check: { kind: "avoids-obstacle" },
    xp: 120,
  },
  {
    id: "motion",
    title: "Охранная сигнализация",
    level: 2,
    preset: "alarm",
    theory:
      "Датчик движения PIR ловит тепловое (инфракрасное) излучение человека и выдаёт на выход HIGH, пока видит движение. Это цифровой датчик: ответ только «да» или «нет», поэтому хватит digitalRead. Так устроены датчики в подъездах и охранных системах.",
    task: "Когда датчик видит движение — светодиод и пищалка включены, когда движения нет — выключены. Включай и выключай движение на схеме.",
    starter: `const int PIR = 7;
const int LED = 13;
const int BUZZ = 8;

void setup() {
  pinMode(PIR, INPUT); pinMode(LED, OUTPUT); pinMode(BUZZ, OUTPUT);
}

void loop() {
  // TODO: прочитай датчик и включи светодиод и пищалку при движении
  delay(50);
}
`,
    check: { kind: "motion-alarm" },
    xp: 60,
  },
  {
    id: "fan",
    title: "Вентилятор с регулятором",
    level: 2,
    preset: "fan",
    theory:
      "Мотор нельзя подключать прямо к выводу Arduino: ему нужен ток в сотни миллиампер, а вывод выдерживает около 20 мА. Поэтому стоит драйвер: на вход IA подают ШИМ — он задаёт скорость, вход IB — направление. Ручка потенциометра даёт 0…1023, а ШИМ принимает 0…255.",
    task: "Ручка потенциометра должна плавно менять скорость мотора от остановки до полной.",
    starter: `const int POT = A0;
const int IA = 3;   // ШИМ: скорость
const int IB = 4;   // направление

void setup() {
  pinMode(IA, OUTPUT); pinMode(IB, OUTPUT);
}

void loop() {
  int knob = analogRead(POT);
  analogWrite(IA, 0);   // TODO: скорость должна зависеть от ручки (0…255)
  digitalWrite(IB, LOW);
  delay(20);
}
`,
    check: { kind: "motor-knob" },
    xp: 70,
  },
  {
    id: "plant",
    title: "Умный горшок",
    level: 2,
    preset: "plant",
    theory:
      "Датчик влажности почвы — это два электрода: во влажной земле ток проходит лучше, и analogRead(A3) растёт. Порог (здесь 358) отделяет «сухо» от «влажно». Хорошее устройство не пищит без остановки: сигнал короткий и повторяется раз в секунду.",
    task: "Когда почва сухая — светодиод и пищалка коротко мигают раз в секунду, когда влажная — молчат. Меняй влажность на схеме.",
    starter: `const int SOIL = A3;   // выше = влажнее
const int LED = 13;
const int BUZZ = 8;
const int DRY = 358;

void setup() {
  pinMode(LED, OUTPUT); pinMode(BUZZ, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int moisture = analogRead(SOIL);
  Serial.println(moisture);
  // TODO: если сухо — короткий сигнал светодиодом и пищалкой, потом пауза
  delay(500);
}
`,
    check: { kind: "dry-alarm" },
    xp: 70,
  },
  {
    id: "radar",
    title: "Радар",
    level: 3,
    preset: "radar",
    theory:
      "Радар — это датчик расстояния на сервоприводе: серво поворачивается шаг за шагом от 0° до 180° и обратно, на каждом шаге измеряется расстояние, а пара «угол, расстояние» печатается в монитор порта. Из таких пар строится карта препятствий — так видят мир роботы и автомобили с парктрониками.",
    task: "Сервопривод должен обходить весь диапазон 0–180° туда и обратно, а на каждом шаге печатать угол и расстояние.",
    starter: `#include <Servo.h>
Servo servo;
const int TRIG = 9;
const int ECHO = 10;
const int SERVO_PIN = 6;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  servo.attach(SERVO_PIN);
}

float distanceCm() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  return us * 0.0343 / 2;
}

void loop() {
  servo.write(90);   // TODO: обойди углы от 0 до 180 и обратно, на каждом шаге печатай угол и расстояние
  delay(60);
}
`,
    check: { kind: "sweep" },
    xp: 100,
  },
  {
    id: "line",
    title: "Робот едет по линии",
    level: 3,
    preset: "line",
    theory:
      "Два датчика света смотрят вниз: над чёрной линией показание низкое. Если линия ушла под левый датчик — робот сворачивает влево (левое колесо медленнее), если под правый — вправо, если под обоими или ни под одним — едет прямо. Это простейший регулятор, который соревнуется на олимпиадах по робототехнике.",
    task: "Робот должен поворачивать в сторону линии: левый датчик на линии — влево, правый — вправо.",
    starter: `const int LEFT = A1;   // над чёрной линией показание низкое
const int RIGHT = A2;
const int L_IA = 3, L_IB = 4;
const int R_IA = 11, R_IB = 12;
const int DARK = 409;

void motor(int ia, int ib, int speed) {
  if (speed >= 0) { analogWrite(ia, speed); digitalWrite(ib, LOW); }
  else { analogWrite(ia, 255 + speed); digitalWrite(ib, HIGH); }
}
void drive(int left, int right) { motor(L_IA, L_IB, left); motor(R_IA, R_IB, right); }

void setup() {
  pinMode(L_IA, OUTPUT); pinMode(L_IB, OUTPUT); pinMode(R_IA, OUTPUT); pinMode(R_IB, OUTPUT);
}

void loop() {
  bool leftOnLine = analogRead(LEFT) < DARK;
  bool rightOnLine = analogRead(RIGHT) < DARK;
  drive(180, 180);   // TODO: поворачивай к линии
  delay(10);
}
`,
    check: { kind: "follows-line" },
    xp: 120,
  },
];

export const arduinoLesson = (id: string) => ARDUINO_LESSONS.find((l) => l.id === id) ?? ARDUINO_LESSONS[0];
