//
//  AllTimeProfit.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 4/13/26.
//

import ForexKit

struct AllTimeProfit: Hashable {
    let profit: Money
    let percentage: Double?

    var currency: Currencies {
        profit.currency
    }

    var value: Double {
        profit.value
    }
}
