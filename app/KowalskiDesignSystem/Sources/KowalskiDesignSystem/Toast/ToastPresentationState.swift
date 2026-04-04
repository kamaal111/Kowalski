//
//  ToastPresentationState.swift
//  KowalskiDesignSystem
//
//  Created by OpenAI Codex on 4/4/26.
//

struct ToastPresentationState: Equatable {
    private(set) var toast: Toast?
    private(set) var isVisible = false

    mutating func prepareToPresent(_ toast: Toast) {
        let shouldResetVisibility = self.toast == nil

        self.toast = toast
        if shouldResetVisibility {
            isVisible = false
        }
    }

    mutating func show() {
        guard toast != nil else { return }

        isVisible = true
    }

    mutating func startDismissal() {
        guard toast != nil else { return }

        isVisible = false
    }

    mutating func finishDismissal() {
        toast = nil
        isVisible = false
    }
}
