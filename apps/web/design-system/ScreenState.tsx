import type { ReactNode } from 'react';

import { SkeletonBlock } from './SkeletonBlock';

export type ScreenStateKind = 'idle' | 'loading' | 'error' | 'empty';

export function ScreenState({
  state,
  emptyLabel,
  errorLabel,
  loadingLabel,
  children,
  testId,
}: {
  state: ScreenStateKind;
  emptyLabel: string;
  errorLabel: string;
  loadingLabel: string;
  children: ReactNode;
  testId?: string;
}) {
  if (state === 'loading') {
    return (
      <div data-testid={testId ?? 'screen-state-loading'} aria-busy="true">
        <p className="ds-screen-state__message">{loadingLabel}</p>
        <SkeletonBlock lines={3} />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div data-testid={testId ?? 'screen-state-error'} role="alert">
        <p className="ds-screen-state__message">{errorLabel}</p>
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div data-testid={testId ?? 'screen-state-empty'}>
        <p className="ds-screen-state__message">{emptyLabel}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function resolveScreenState(params: {
  loading: boolean;
  error: boolean;
  hasData: boolean;
}): ScreenStateKind {
  if (params.loading) {
    return 'loading';
  }
  if (params.error) {
    return 'error';
  }
  if (!params.hasData) {
    return 'empty';
  }
  return 'idle';
}
