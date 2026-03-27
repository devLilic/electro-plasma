import type {
  ActivateItemPlayoutInput,
  ItemSlideshowPlayoutMachine,
  ManualStepPlayoutInput,
  TickPlayoutInput,
} from '@domain/item-slideshow-playout'

export class PlayoutService {
  constructor(private readonly machine: ItemSlideshowPlayoutMachine) {}

  activateItem(input: ActivateItemPlayoutInput) {
    return this.machine.activateItem(input)
  }

  tick(input: TickPlayoutInput) {
    return this.machine.tick(input)
  }

  pause(input: TickPlayoutInput) {
    return this.machine.pause(input)
  }

  resume(input: TickPlayoutInput) {
    return this.machine.resume(input)
  }

  stop(input: TickPlayoutInput) {
    return this.machine.stop(input)
  }

  next(input: ManualStepPlayoutInput) {
    return this.machine.next(input)
  }

  previous(input: ManualStepPlayoutInput) {
    return this.machine.previous(input)
  }

  getState() {
    return this.machine.getState()
  }
}
