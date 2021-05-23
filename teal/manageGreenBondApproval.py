import sys

from pyteal import *
from utils import parseArgs


def contract(args):

    # Setup
    stablecoin_escrow_balance = AssetHolding.balance(Int(1), Int(args["STABLECOIN_ID"]))
    bond_escrow_balance = AssetHolding.balance(Int(2), Int(args["BOND_ID"]))
    sender_bond_balance = AssetHolding.balance(Int(0), Int(args["BOND_ID"]))
    bond_total = AssetParam.total(Int(0))
    reserve = App.globalGetEx(Int(1), Bytes("Reserve"))

    # Current coupon round, 0 if none and BOND_LENGTH if finished - stored
    coupon_round = If(
        Global.latest_timestamp() >= Int(args["MATURITY_DATE"]),
        Int(args["BOND_LENGTH"]),  # coupon round is max BOND_LENGTH
        If(
            Global.latest_timestamp() < Int(args["END_BUY_DATE"]),
            Int(0),  # no coupons if before start date
            Div(
                Global.latest_timestamp() - Int(args["END_BUY_DATE"]),
                Int(args["PERIOD"])
            )
        )
    )

    # Implementation
    num_bonds_in_circ = bond_total.value() - bond_escrow_balance.value()
    principal_owed = If(
        Global.latest_timestamp() >= Int(args["MATURITY_DATE"]),
        Int(args["BOND_PRINCIPAL"]) * num_bonds_in_circ,
        Int(0)  # 0 if not yet maturity
    )
    # Value owed across all bonds
    global_value_owed_now = reserve.value() + principal_owed
    # Can afford to pay out all money owed - stored
    has_defaulted = global_value_owed_now > stablecoin_escrow_balance.value()
    has_defaulted_stored = ScratchVar(TealType.uint64)

    # CLAIM DEFAULT: Verify stablecoin payout
    # split remaining funds excluding 'reserve' which is unclaimed coupons amount
    stablecoin_transfer = Eq(
        num_bonds_in_circ * Gtxn[3].asset_amount(),
        (stablecoin_escrow_balance.value() - reserve.value()) * sender_bond_balance.value()
    )

    # RATE
    round_passed = Btoi(Txn.application_args[1])
    round_passed_stored = ScratchVar(TealType.uint64)
    rating_passed = Btoi(Txn.application_args[2])
    rating_passed_stored = ScratchVar(TealType.uint64)
    # Verify round passed: 0 is 'Use of Proceeds', 1-BOND_LENGTH for coupon reporting
    verify_round_passed = Or(
        And(
            Global.latest_timestamp() < Int(args["START_BUY_DATE"]),
            round_passed_stored.load() == Int(0)
        ),
        And(
            Global.latest_timestamp() >= Int(args["END_BUY_DATE"]),
            Global.latest_timestamp() < Int(args["MATURITY_DATE"]),
            round_passed_stored.load() == (coupon_round + Int(1))
        )
    )
    # Verify rating passed: 1-5 stars
    verify_rating_passed = And(
        rating_passed_stored.load() >= Int(1),
        rating_passed_stored.load() <= Int(5)
    )
    # Combine
    rate_verify = And(
        verify_round_passed,
        verify_rating_passed,
        Txn.sender() == Addr(args["GREEN_VERIFIER_ADDR"])
    )
    # Can fit 8 single byte ints in global state value
    array_slot = round_passed_stored.load() / Int(8)
    index_slot = round_passed_stored.load() % Int(8)
    array = App.globalGetEx(Int(0), Itob(array_slot))  # Initialise if needed
    # Update
    on_rate = Seq([
        round_passed_stored.store(round_passed),
        rating_passed_stored.store(rating_passed),
        Assert(rate_verify),
        array,
        App.globalPut(
            Itob(array_slot),
            SetByte(
                If(array.hasValue(), array.value(), Bytes("base16", "0x0000000000000000")),
                index_slot,
                rating_passed_stored.load()
            )
        ),
        Return(Int(1))
    ])

    # HANDLE NO OP
    handle_no_op = Seq([
        If(Txn.application_args[0] == Bytes("rate"), on_rate),
        Assert(
            And(
                Txn.applications[1] == Int(args["MAIN_APP_ID"]),
                Txn.assets[0] == Int(args["BOND_ID"]),
                Txn.accounts[1] == Addr(args["STABLECOIN_ESCROW_ADDR"]),
                Txn.accounts[2] == Addr(args["BOND_ESCROW_ADDR"])
            )
        ),
        stablecoin_escrow_balance,
        bond_escrow_balance,
        sender_bond_balance,
        bond_total,
        reserve,
        has_defaulted_stored.store(has_defaulted),
        Cond(
            [Txn.application_args[0] == Bytes("defaulted"), has_defaulted_stored.load()],
            [Txn.application_args[0] == Bytes("not_defaulted"), Not(has_defaulted_stored.load())],
            [Txn.application_args[0] == Bytes("claim_default"), has_defaulted_stored.load() & stablecoin_transfer]
        )
    ])

    program = Cond(
        [Txn.application_id() == Int(0), Int(1)],  # on creation
        [Txn.on_completion() == OnComplete.DeleteApplication, Int(0)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Int(0)],
        [Txn.on_completion() == OnComplete.CloseOut, Int(0)],
        [Txn.on_completion() == OnComplete.OptIn, Int(0)],
        [Int(1), handle_no_op]
    )

    return program


if __name__ == "__main__":
    params = {}
    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parseArgs(sys.argv[1], params)

    print(compileTeal(contract(params), Mode.Application, version=3))