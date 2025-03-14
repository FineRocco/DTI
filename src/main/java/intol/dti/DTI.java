package intol.dti;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import bftsmart.tom.ServiceProxy;

public class DTI<K, V> {
    private final Logger logger = LoggerFactory.getLogger("bftsmart");
    private final ServiceProxy serviceProxy;

    public DTI(int id) {
        serviceProxy = new ServiceProxy(id);
    }

    public <K,V> Map<K,V> getCoins() {
        byte[] rep;
        try{
            DTIMessage<K,V> request = new DTIMessage<>();
            request.setType(DTIRequestType.MY_COINS);

            //invokes BFT-SMaRt
            rep = serviceProxy.invokeUnordered(DTIMessage.toBytes(request));
        } catch (Exception e) {
            logger.error("Failed to send MY_COINS request");
            return null;
        }

        if(rep.length == 0){
            return null;
        }
        try{
            DTIMessage<K,V> response = DTIMessage.fromBytes(rep);
            return response.getMap();
        } catch (Exception e) {
            logger.error("Failed to deserialize response of MY_COINS request");
            return null;
        }

    }

    public Integer mint(float value) {
        return null;
        // TODO
    }

    public Integer spend(Integer[] coinIDs, int receiverId, int totalValue) {
        return null;
        // TODO
    }

}
