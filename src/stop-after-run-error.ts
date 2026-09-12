import {
  EventType,
  type AbstractAgent,
  type BaseEvent,
  type RunAgentInput,
} from "@ag-ui/client";
import { Observable } from "rxjs";

/**
 * LangGraph can emit RUN_ERROR and then close the active graph step, producing
 * STEP_FINISHED after a terminal error. AG-UI correctly rejects that sequence,
 * so stop forwarding events after the first RUN_ERROR for this run.
 */
export function stopAfterRunError(
  input: RunAgentInput,
  next: AbstractAgent,
): Observable<BaseEvent> {
  return new Observable<BaseEvent>((subscriber) => {
    let runErrored = false;

    const subscription = next.run(input).subscribe({
      next(event) {
        if (runErrored) return;

        subscriber.next(event);

        if (event.type === EventType.RUN_ERROR) {
          runErrored = true;
        }
      },
      error(error) {
        subscriber.error(error);
      },
      complete() {
        subscriber.complete();
      },
    });

    return () => subscription.unsubscribe();
  });
}
