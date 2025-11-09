//
//  KowalskiPortfolio.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/1/25.
//

import Observation

@Observable
public final class KowalskiPortfolio {
    private init() { }

    @MainActor
    func storeTransaction(_ payload: TransactionPayload) async { }

    // MARK: Factory

    public static func `default`() -> KowalskiPortfolio {
        KowalskiPortfolio()
    }

    public static func preview() -> KowalskiPortfolio {
        KowalskiPortfolio()
    }
}
