from pyteal import *


def contract():

    on_update = Txn.sender() == Global.creator_address()

    program = Cond(
        [Txn.application_id() == Int(0), Int(1)],
        [Txn.on_completion() == OnComplete.UpdateApplication, on_update],
    )

    return And(Global.group_size() == Int(1), program)


if __name__ == "__main__":
    print(compileTeal(contract(), Mode.Application, version=3))
