package intol.dti;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serializable;
import java.util.HashSet;

public class DTIMessage<K,V> implements Serializable {
    private DTIRequestType type;
    private K id;
    private V value;
    private int ownerId;
    private HashSet<K> keySet;
    private int size;


    public DTIMessage() {
    }

    public static <K,V>byte[] toBytes(DTIMessage<K,V> message) throws IOException {
        ByteArrayOutputStream byteOut = new ByteArrayOutputStream();
        ObjectOutputStream objOut = new ObjectOutputStream(byteOut);
        objOut.writeObject(message);

        objOut.flush();
        byteOut.flush();

        return byteOut.toByteArray();
        }

        @SuppressWarnings("unchecked")
        public static <K,V> DTIMessage<K,V> fromBytes(byte[] rep) throws IOException, ClassNotFoundException {
        ByteArrayInputStream byteIn = new ByteArrayInputStream(rep);
        ObjectInputStream objIn = new ObjectInputStream(byteIn);
        return (DTIMessage<K,V>) objIn.readObject();
        }

        public DTIRequestType getType() {
        return type;
        }

        public void setType(DTIRequestType type) {
        this.type = type;
        }

        public K getId() {
        return id;
        }

        public void setId(K id) {
        this.id = id;
        }

        public V getValue() {
        return value;
        }

        public void setValue(V value) {
        this.value = value;
        }

        public HashSet<K> getKeySet() {
        return keySet;
        }

        public void setKeySet(HashSet<K> keySet) {
        this.keySet = keySet;
        }

        public int getSize() {
        return size;
        }

        public void setSize(int size) {
        this.size = size;
        }

        public int getOwnerId() {
            return ownerId;
        }
        
        public void setOwnerId(int ownerId) {
            this.ownerId = ownerId;
        }

}


