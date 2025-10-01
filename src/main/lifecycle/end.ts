/**
  * The goal for this here is to use this execute the persistance mechanisms rather
  * than having them update and write to the disk on every change, however
  * we have no (known) way of knowing if vscode will ever properly execute the shutdown
  * hook during a crash, power loss, forced quit, system update, or what have you.
  * 
  * So for now, this is a no-op.
  */
export default function () {

}