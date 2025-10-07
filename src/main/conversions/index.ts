import { Converter } from "./Converter";
import { Converter1_0_1_to_1_1_0 } from "./Converter_1.0.1_1.1.0";

export const REQUIRED_CONVERTERS: Converter[] = [
  new Converter1_0_1_to_1_1_0(),
  // future converters go here.
];

export async function runConverts() {
  for(const converter of REQUIRED_CONVERTERS) {
    await converter.convert();
  }
}