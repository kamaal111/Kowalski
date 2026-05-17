//
//  AllTimeProfit.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 4/13/26.
//

import KowalskiModels

struct AllTimeProfit: Hashable {
    let profit: Money
    let percentage: Double?

    var currency: KowalskiCurrency {
        profit.currency
    }

    var value: Double {
        profit.value
    }
}
