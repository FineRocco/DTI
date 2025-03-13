package intol.dti;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import bftsmart.tom.ServiceProxy;

public class DTI<K, V> {
    private final Logger logger = LoggerFactory.getLogger("bftsmart");
    private final ServiceProxy serviceProxy;

    public DTI(int id) {
        serviceProxy = new ServiceProxy(id);
    }

    public Integer mint(float value) {
        return null;
        // TODO
    }

    public <K,V> Object getCoins(int ownerId) {
        return null;
        // TODO
    }

    public Integer spend(Integer[] coinIDs, int receiverId, int totalValue) {
        return null;
        // TODO
    }

}
